import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { ProjectMemberRole } from '../project-members/enums/project-member-role.enum';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Project } from './entities/project.entity';
import { ProjectAccessRole } from './enums/project-access-role.enum';
import { ProjectAccessService } from './project-access.service';

describe('ProjectAccessService', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const memberId = '22222222-2222-4222-8222-222222222222';
  const projectId = '33333333-3333-4333-8333-333333333333';

  const ownerActor: AuthenticatedPrincipal = {
    userId: ownerId,
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: UserRole.User,
  };
  const memberActor: AuthenticatedPrincipal = {
    userId: memberId,
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    role: UserRole.User,
  };
  const adminActor: AuthenticatedPrincipal = {
    userId: '44444444-4444-4444-8444-444444444444',
    sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    role: UserRole.Admin,
  };

  let queryBuilder: {
    innerJoinAndSelect: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    withDeleted: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let repository: { createQueryBuilder: jest.Mock };
  let projectAccessService: ProjectAccessService;

  function createProject(input: Partial<Project> = {}): Project {
    return Object.assign(new Project(), {
      id: projectId,
      ownerId,
      owner: Object.assign(new User(), { id: ownerId }),
      members: [],
      archivedAt: null,
      deletedAt: null,
      ...input,
    });
  }

  function createMembership(
    role: ProjectMemberRole,
    userId = memberId,
  ): ProjectMember {
    return Object.assign(new ProjectMember(), {
      projectId,
      userId,
      role,
    });
  }

  beforeEach(() => {
    queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    projectAccessService = new ProjectAccessService(
      repository as unknown as Repository<Project>,
    );
  });

  describe('resolveAccessRole', () => {
    it('resolves owner before any other access source', () => {
      const project = createProject();

      expect(
        projectAccessService.resolveAccessRole(
          { ...adminActor, userId: ownerId },
          project,
          createMembership(ProjectMemberRole.Member, ownerId),
        ),
      ).toBe(ProjectAccessRole.Owner);
    });

    it.each([
      [ProjectMemberRole.Manager, ProjectAccessRole.Manager],
      [ProjectMemberRole.Member, ProjectAccessRole.Member],
    ])('maps membership role %s to access role %s', (role, expected) => {
      expect(
        projectAccessService.resolveAccessRole(
          memberActor,
          createProject(),
          createMembership(role),
        ),
      ).toBe(expected);
    });

    it('resolves explicit membership before ADMIN viewer access', () => {
      const adminMembership = createMembership(
        ProjectMemberRole.Manager,
        adminActor.userId,
      );

      expect(
        projectAccessService.resolveAccessRole(
          adminActor,
          createProject(),
          adminMembership,
        ),
      ).toBe(ProjectAccessRole.Manager);
    });

    it('resolves a non-member ADMIN as read-only viewer', () => {
      expect(
        projectAccessService.resolveAccessRole(
          adminActor,
          createProject(),
          null,
        ),
      ).toBe(ProjectAccessRole.AdminViewer);
    });

    it('returns null for an unrelated USER', () => {
      expect(
        projectAccessService.resolveAccessRole(
          memberActor,
          createProject(),
          null,
        ),
      ).toBeNull();
    });
  });

  describe('findReadableProjectOrThrow', () => {
    it('returns the project and OWNER access for its owner', async () => {
      const project = createProject();
      queryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectAccessService.findReadableProjectOrThrow(
          ownerActor,
          projectId,
        ),
      ).resolves.toEqual({
        project,
        accessRole: ProjectAccessRole.Owner,
      });
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'project.members',
        'actorMembership',
        'actorMembership.userId = :actorUserId',
        { actorUserId: ownerId },
      );
    });

    it('returns membership access when the actor belongs to the project', async () => {
      const membership = createMembership(ProjectMemberRole.Member);
      const project = createProject({ members: [membership] });
      queryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectAccessService.findReadableProjectOrThrow(
          memberActor,
          projectId,
        ),
      ).resolves.toEqual({
        project,
        accessRole: ProjectAccessRole.Member,
      });
    });

    it('masks an unrelated project as not found', async () => {
      queryBuilder.getOne.mockResolvedValue(createProject());

      await expect(
        projectAccessService.findReadableProjectOrThrow(
          memberActor,
          projectId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects includeDeleted for a non-ADMIN before querying', async () => {
      await expect(
        projectAccessService.findReadableProjectOrThrow(
          ownerActor,
          projectId,
          { includeDeleted: true },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('includes soft-deleted rows for an ADMIN request', async () => {
      const project = createProject({ deletedAt: new Date() });
      queryBuilder.getOne.mockResolvedValue(project);

      await projectAccessService.findReadableProjectOrThrow(
        adminActor,
        projectId,
        { includeDeleted: true },
      );

      expect(queryBuilder.withDeleted).toHaveBeenCalledTimes(1);
    });

    it('rejects a missing project', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        projectAccessService.findReadableProjectOrThrow(
          adminActor,
          projectId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOwnedMutableProjectOrThrow', () => {
    it('uses the transaction repository and locks the owned project', async () => {
      const transactionalRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const entityManager = {
        getRepository: jest.fn().mockReturnValue(transactionalRepository),
      };
      const project = createProject();
      queryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectAccessService.findOwnedMutableProjectOrThrow(
          ownerActor,
          projectId,
          entityManager as unknown as EntityManager,
        ),
      ).resolves.toBe(project);
      expect(entityManager.getRepository).toHaveBeenCalledWith(Project);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.ownerId = :ownerId',
        { ownerId },
      );
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(queryBuilder.withDeleted).toHaveBeenCalledTimes(1);
    });

    it('rejects an archived project even for its owner', async () => {
      queryBuilder.getOne.mockResolvedValue(
        createProject({ archivedAt: new Date() }),
      );

      await expect(
        projectAccessService.findOwnedMutableProjectOrThrow(
          ownerActor,
          projectId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a soft-deleted project even for its owner', async () => {
      queryBuilder.getOne.mockResolvedValue(
        createProject({ deletedAt: new Date() }),
      );

      await expect(
        projectAccessService.findOwnedMutableProjectOrThrow(
          ownerActor,
          projectId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('masks a project outside owner scope as not found', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        projectAccessService.findOwnedMutableProjectOrThrow(
          adminActor,
          projectId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
