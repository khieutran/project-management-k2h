import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  type EntityManager,
  QueryFailedError,
  type Repository,
} from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { Project } from '../projects/entities/project.entity';
import { ProjectAccessRole } from '../projects/enums/project-access-role.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import type { AddProjectMemberDto } from './dto/add-project-member.dto';
import type { ChangeProjectMemberRoleDto } from './dto/change-project-member-role.dto';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectMemberRole } from './enums/project-member-role.enum';
import { ProjectMembersService } from './project-members.service';

describe('ProjectMembersService', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const memberId = '22222222-2222-4222-8222-222222222222';
  const projectId = '33333333-3333-4333-8333-333333333333';
  const actor: AuthenticatedPrincipal = {
    userId: ownerId,
    sessionId: '99999999-9999-4999-8999-999999999999',
    role: UserRole.User,
  };
  const input: AddProjectMemberDto = {
    email: 'member@example.com',
    role: ProjectMemberRole.Member,
  };

  let membersRepository: {
    find: jest.Mock;
  };
  let transactionMembersRepository: {
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let transactionQueryBuilder: {
    innerJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let entityManager: {
    getRepository: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };
  let projectAccessService: {
    findReadableProjectOrThrow: jest.Mock;
    findOwnedMutableProjectOrThrow: jest.Mock;
  };
  let usersService: {
    findByEmail: jest.Mock;
  };
  let service: ProjectMembersService;

  function createUser(overrides: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: memberId,
      email: 'member@example.com',
      displayName: 'Project Member',
      ...overrides,
    });
  }

  function createProject(overrides: Partial<Project> = {}): Project {
    return Object.assign(new Project(), {
      id: projectId,
      ownerId,
      owner: createUser({
        id: ownerId,
        email: 'owner@example.com',
        displayName: 'Project Owner',
      }),
      archivedAt: null,
      deletedAt: null,
      ...overrides,
    });
  }

  function createMembership(
    role: ProjectMemberRole,
    joinedAt: string,
  ): ProjectMember {
    const user = createUser();

    return Object.assign(new ProjectMember(), {
      id: '44444444-4444-4444-8444-444444444444',
      projectId,
      userId: user.id,
      user,
      role,
      joinedAt: new Date(joinedAt),
    });
  }

  beforeEach(() => {
    membersRepository = {
      find: jest.fn(),
    };
    transactionQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    transactionMembersRepository = {
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(transactionQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    entityManager = {
      getRepository: jest.fn().mockReturnValue(transactionMembersRepository),
    };
    dataSource = {
      transaction: jest.fn(
        async (operation: (manager: EntityManager) => Promise<unknown>) =>
          operation(entityManager as unknown as EntityManager),
      ),
    };
    projectAccessService = {
      findReadableProjectOrThrow: jest.fn(),
      findOwnedMutableProjectOrThrow: jest.fn(),
    };
    usersService = {
      findByEmail: jest.fn(),
    };
    service = new ProjectMembersService(
      membersRepository as unknown as Repository<ProjectMember>,
      dataSource as unknown as DataSource,
      projectAccessService as unknown as ProjectAccessService,
      usersService as unknown as UsersService,
    );
  });

  describe('findAll', () => {
    it('authorizes the actor and returns the owner before ordered members', async () => {
      const project = createProject();
      const firstMember = createMembership(
        ProjectMemberRole.Manager,
        '2026-10-16T08:00:00.000Z',
      );
      const secondMember = createMembership(
        ProjectMemberRole.Member,
        '2026-10-17T08:00:00.000Z',
      );

      projectAccessService.findReadableProjectOrThrow.mockResolvedValue({
        project,
        accessRole: ProjectAccessRole.Member,
      });
      membersRepository.find.mockResolvedValue([firstMember, secondMember]);

      const result = await service.findAll(actor, projectId);

      expect(
        projectAccessService.findReadableProjectOrThrow,
      ).toHaveBeenCalledWith(actor, projectId);
      expect(membersRepository.find).toHaveBeenCalledWith({
        where: { projectId },
        relations: { user: true },
        order: { joinedAt: 'ASC' },
      });
      expect(result.data.map((entry) => entry.role)).toEqual([
        'OWNER',
        ProjectMemberRole.Manager,
        ProjectMemberRole.Member,
      ]);
      expect(result.data[0]).toEqual({
        user: {
          id: ownerId,
          email: 'owner@example.com',
          displayName: 'Project Owner',
        },
        role: 'OWNER',
        joinedAt: null,
      });
    });

    it('does not query memberships when project access is rejected', async () => {
      const accessError = new NotFoundException();

      projectAccessService.findReadableProjectOrThrow.mockRejectedValue(
        accessError,
      );

      await expect(service.findAll(actor, projectId)).rejects.toBe(accessError);
      expect(membersRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('adds a registered user in one transaction and returns a safe response', async () => {
      const project = createProject();
      const user = createUser();
      const membership = createMembership(
        ProjectMemberRole.Member,
        '2026-10-16T08:00:00.000Z',
      );

      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        project,
      );
      usersService.findByEmail.mockResolvedValue(user);
      transactionMembersRepository.findOneBy.mockResolvedValue(null);
      transactionMembersRepository.create.mockReturnValue(membership);
      transactionMembersRepository.save.mockResolvedValue(membership);

      const result = await service.add(actor, projectId, {
        ...input,
        email: '  MEMBER@Example.COM  ',
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(
        projectAccessService.findOwnedMutableProjectOrThrow,
      ).toHaveBeenCalledWith(actor, projectId, entityManager);
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'member@example.com',
        entityManager,
      );
      expect(transactionMembersRepository.findOneBy).toHaveBeenCalledWith({
        projectId,
        userId: user.id,
      });
      expect(transactionMembersRepository.create).toHaveBeenCalledWith({
        projectId,
        userId: user.id,
        user,
        role: ProjectMemberRole.Member,
      });
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        role: ProjectMemberRole.Member,
        joinedAt: '2026-10-16T08:00:00.000Z',
      });
    });

    it('checks owner authorization before looking up the email', async () => {
      projectAccessService.findOwnedMutableProjectOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.add(actor, projectId, input)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('rejects an email that does not belong to a registered user', async () => {
      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        createProject(),
      );
      usersService.findByEmail.mockResolvedValue(null);

      let caughtError: unknown;

      try {
        await service.add(actor, projectId, input);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(NotFoundException);
      expect((caughtError as NotFoundException).getResponse()).toEqual({
        code: 'PROJECT_MEMBER_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng đã đăng ký',
      });
      expect(transactionMembersRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('rejects adding the project owner as a membership', async () => {
      const project = createProject();

      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        project,
      );
      usersService.findByEmail.mockResolvedValue(project.owner);

      let caughtError: unknown;

      try {
        await service.add(actor, projectId, {
          ...input,
          email: project.owner.email,
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
      expect((caughtError as BadRequestException).getResponse()).toEqual({
        code: 'PROJECT_MEMBER_OWNER_CANNOT_BE_ADDED',
        message: 'Owner không thể được thêm làm thành viên',
      });
      expect(transactionMembersRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a membership that already exists', async () => {
      const existingMembership = createMembership(
        ProjectMemberRole.Member,
        '2026-10-16T08:00:00.000Z',
      );

      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        createProject(),
      );
      usersService.findByEmail.mockResolvedValue(existingMembership.user);
      transactionMembersRepository.findOneBy.mockResolvedValue(
        existingMembership,
      );

      let caughtError: unknown;

      try {
        await service.add(actor, projectId, input);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ConflictException);
      expect((caughtError as ConflictException).getResponse()).toEqual({
        code: 'PROJECT_MEMBER_ALREADY_EXISTS',
        message: 'Người dùng đã là thành viên của dự án',
      });
      expect(transactionMembersRepository.save).not.toHaveBeenCalled();
    });

    it('maps a concurrent PostgreSQL unique violation to the same conflict', async () => {
      type PostgresDriverError = Error & { code: string };
      const user = createUser();
      const membership = createMembership(
        ProjectMemberRole.Manager,
        '2026-10-16T08:00:00.000Z',
      );
      const uniqueViolation = new QueryFailedError<PostgresDriverError>(
        'INSERT INTO project_members ...',
        [],
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        createProject(),
      );
      usersService.findByEmail.mockResolvedValue(user);
      transactionMembersRepository.findOneBy.mockResolvedValue(null);
      transactionMembersRepository.create.mockReturnValue(membership);
      transactionMembersRepository.save.mockRejectedValue(uniqueViolation);

      await expect(service.add(actor, projectId, input)).rejects.toMatchObject({
        response: {
          code: 'PROJECT_MEMBER_ALREADY_EXISTS',
        },
      });
    });
  });

  describe('changeRole', () => {
    it('lets the owner change a member role using the transaction repository', async () => {
      const membership = createMembership(
        ProjectMemberRole.Member,
        '2026-10-16T08:00:00.000Z',
      );
      const roleChange: ChangeProjectMemberRoleDto = {
        role: ProjectMemberRole.Manager,
      };

      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        createProject(),
      );
      transactionQueryBuilder.getOne.mockResolvedValue(membership);
      transactionMembersRepository.save.mockImplementation(
        async (value) => value,
      );

      const result = await service.changeRole(
        actor,
        projectId,
        memberId,
        roleChange,
      );

      expect(
        projectAccessService.findOwnedMutableProjectOrThrow,
      ).toHaveBeenCalledWith(actor, projectId, entityManager);
      expect(
        transactionMembersRepository.createQueryBuilder,
      ).toHaveBeenCalledWith('membership');
      expect(transactionQueryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
        'membership.user',
        'user',
      );
      expect(transactionQueryBuilder.andWhere).toHaveBeenCalledWith(
        'membership.projectId = :projectId',
        { projectId },
      );
      expect(transactionQueryBuilder.andWhere).toHaveBeenCalledWith(
        'membership.userId = :userId',
        { userId: memberId },
      );
      expect(transactionQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(transactionMembersRepository.save).toHaveBeenCalledWith(
        membership,
      );
      expect(result.role).toBe(ProjectMemberRole.Manager);
    });

    it('rejects a manager or member before querying the target membership', async () => {
      projectAccessService.findOwnedMutableProjectOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.changeRole(actor, projectId, memberId, {
          role: ProjectMemberRole.Manager,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(transactionQueryBuilder.getOne).not.toHaveBeenCalled();
    });

    it('returns the member-not-found contract for an unknown target', async () => {
      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        createProject(),
      );
      transactionQueryBuilder.getOne.mockResolvedValue(null);

      let caughtError: unknown;

      try {
        await service.changeRole(actor, projectId, memberId, {
          role: ProjectMemberRole.Manager,
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(NotFoundException);
      expect((caughtError as NotFoundException).getResponse()).toEqual({
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'Không tìm thấy thành viên trong dự án',
      });
      expect(transactionMembersRepository.save).not.toHaveBeenCalled();
    });

    it('preserves the archived or deleted project lock error', async () => {
      const lockError = new ConflictException({
        code: 'PROJECT_MEMBERSHIP_LOCKED',
        message: 'Không thể thay đổi thành viên của project đã khóa',
      });

      projectAccessService.findOwnedMutableProjectOrThrow.mockRejectedValue(
        lockError,
      );

      await expect(
        service.changeRole(actor, projectId, memberId, {
          role: ProjectMemberRole.Manager,
        }),
      ).rejects.toBe(lockError);
    });
  });

  describe('remove', () => {
    it('lets the owner remove exactly the requested membership', async () => {
      const project = createProject();
      const membership = createMembership(
        ProjectMemberRole.Member,
        '2026-10-16T08:00:00.000Z',
      );

      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        project,
      );
      transactionQueryBuilder.getOne.mockResolvedValue(membership);
      transactionMembersRepository.remove.mockResolvedValue(membership);

      await service.remove(actor, projectId, memberId);

      expect(transactionMembersRepository.remove).toHaveBeenCalledTimes(1);
      expect(transactionMembersRepository.remove).toHaveBeenCalledWith(
        membership,
      );
      expect(project.ownerId).toBe(ownerId);
    });

    it('rejects a non-owner before querying or deleting a membership', async () => {
      projectAccessService.findOwnedMutableProjectOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.remove(actor, projectId, memberId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(transactionQueryBuilder.getOne).not.toHaveBeenCalled();
      expect(transactionMembersRepository.remove).not.toHaveBeenCalled();
    });

    it('returns member not found when the requested membership is absent', async () => {
      projectAccessService.findOwnedMutableProjectOrThrow.mockResolvedValue(
        createProject(),
      );
      transactionQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.remove(actor, projectId, memberId),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_MEMBER_NOT_FOUND' },
      });
      expect(transactionMembersRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('leave', () => {
    const memberActor: AuthenticatedPrincipal = {
      ...actor,
      userId: memberId,
    };

    it('removes the current actor membership inside the transaction', async () => {
      const project = createProject();
      const membership = createMembership(
        ProjectMemberRole.Manager,
        '2026-10-16T08:00:00.000Z',
      );

      projectAccessService.findReadableProjectOrThrow.mockResolvedValue({
        project,
        accessRole: ProjectAccessRole.Manager,
      });
      transactionQueryBuilder.getOne.mockResolvedValue(membership);
      transactionMembersRepository.remove.mockResolvedValue(membership);

      await service.leave(memberActor, projectId);

      expect(
        projectAccessService.findReadableProjectOrThrow,
      ).toHaveBeenCalledWith(memberActor, projectId, {
        entityManager,
      });
      expect(transactionQueryBuilder.andWhere).toHaveBeenCalledWith(
        'membership.userId = :userId',
        { userId: memberActor.userId },
      );
      expect(transactionQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(transactionMembersRepository.remove).toHaveBeenCalledWith(
        membership,
      );
      expect(project.ownerId).toBe(ownerId);
    });

    it('rejects the project owner because ownership is not a membership', async () => {
      const project = createProject();

      projectAccessService.findReadableProjectOrThrow.mockResolvedValue({
        project,
        accessRole: ProjectAccessRole.Owner,
      });

      let caughtError: unknown;

      try {
        await service.leave(actor, projectId);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);
      expect((caughtError as BadRequestException).getResponse()).toEqual({
        code: 'PROJECT_OWNER_CANNOT_LEAVE',
        message: 'Owner không thể rời project',
      });
      expect(transactionMembersRepository.remove).not.toHaveBeenCalled();
    });

    it.each([
      { archivedAt: new Date('2026-10-18T00:00:00.000Z') },
      { deletedAt: new Date('2026-10-18T00:00:00.000Z') },
    ])('rejects leaving a locked project: %o', async (projectState) => {
      projectAccessService.findReadableProjectOrThrow.mockResolvedValue({
        project: createProject(projectState),
        accessRole: ProjectAccessRole.Member,
      });

      await expect(service.leave(memberActor, projectId)).rejects.toMatchObject(
        {
          response: { code: 'PROJECT_MEMBERSHIP_LOCKED' },
        },
      );
      expect(transactionMembersRepository.remove).not.toHaveBeenCalled();
    });

    it('returns member not found when the actor has no membership row', async () => {
      projectAccessService.findReadableProjectOrThrow.mockResolvedValue({
        project: createProject(),
        accessRole: ProjectAccessRole.AdminViewer,
      });
      transactionQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.leave(memberActor, projectId)).rejects.toMatchObject(
        {
          response: { code: 'PROJECT_MEMBER_NOT_FOUND' },
        },
      );
    });
  });
});
