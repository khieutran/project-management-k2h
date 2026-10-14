import { ConflictException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
import {
  type ListProjectsQueryDto,
  ProjectListView,
} from './dto/list-projects-query.dto';
import { Project } from './entities/project.entity';
import { ProjectStatus } from './enums/project-status.enum';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  const actor: AuthenticatedPrincipal = {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '99999999-9999-4999-8999-999999999999',
    role: UserRole.User,
  };
  const input: CreateProjectDto = {
    key: 'K2H',
    name: 'Project Management K2H',
    description: 'Learn by building',
    startDate: '2026-10-15',
    endDate: '2027-03-31',
  };

  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    innerJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    withDeleted: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let projectsService: ProjectsService;

  beforeEach(() => {
    queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    projectsService = new ProjectsService(
      repository as unknown as Repository<Project>,
    );
  });

  describe('create', () => {
    it('creates an owned planning project and returns its safe response', async () => {
      const owner = Object.assign(new User(), {
        id: actor.userId,
        displayName: 'Nguyen Van A',
      });
      const createdProject = Object.assign(new Project(), {
        ...input,
        ownerId: actor.userId,
        status: ProjectStatus.Planning,
      });
      const savedProject = Object.assign(createdProject, {
        id: '22222222-2222-4222-8222-222222222222',
      });
      const loadedProject = Object.assign(savedProject, {
        owner,
        archivedAt: null,
        deletedAt: null,
        createdAt: new Date('2026-10-15T10:00:00.000Z'),
        updatedAt: new Date('2026-10-15T10:00:00.000Z'),
      });

      repository.create.mockReturnValue(createdProject);
      repository.save.mockResolvedValue(savedProject);
      repository.findOne.mockResolvedValue(loadedProject);

      const result = await projectsService.create(actor, input);

      expect(repository.create).toHaveBeenCalledWith({
        key: input.key,
        name: input.name,
        description: input.description,
        ownerId: actor.userId,
        status: ProjectStatus.Planning,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      expect(repository.save).toHaveBeenCalledWith(createdProject);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: savedProject.id },
        relations: { owner: true },
      });
      expect(result).toEqual({
        id: savedProject.id,
        key: input.key,
        name: input.name,
        description: input.description,
        status: ProjectStatus.Planning,
        startDate: input.startDate,
        endDate: input.endDate,
        archivedAt: null,
        deletedAt: null,
        owner: {
          id: owner.id,
          displayName: owner.displayName,
        },
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-15T10:00:00.000Z',
      });
      expect(result).not.toHaveProperty('ownerId');
    });

    it('normalizes omitted optional values to null before persistence', async () => {
      const minimalInput: CreateProjectDto = {
        key: 'API',
        name: 'API Project',
      };
      const createdProject = Object.assign(new Project(), {
        ...minimalInput,
        description: null,
        ownerId: actor.userId,
        status: ProjectStatus.Planning,
        startDate: null,
        endDate: null,
      });
      const savedProject = Object.assign(createdProject, {
        id: '33333333-3333-4333-8333-333333333333',
      });
      const loadedProject = Object.assign(savedProject, {
        owner: Object.assign(new User(), {
          id: actor.userId,
          displayName: 'Nguyen Van A',
        }),
        archivedAt: null,
        deletedAt: null,
        createdAt: new Date('2026-10-15T10:00:00.000Z'),
        updatedAt: new Date('2026-10-15T10:00:00.000Z'),
      });

      repository.create.mockReturnValue(createdProject);
      repository.save.mockResolvedValue(savedProject);
      repository.findOne.mockResolvedValue(loadedProject);

      await projectsService.create(actor, minimalInput);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          startDate: null,
          endDate: null,
        }),
      );
    });

    it('maps a PostgreSQL unique violation to a project-key conflict', async () => {
      type PostgresDriverError = Error & { code: string };

      const uniqueViolation = new QueryFailedError<PostgresDriverError>(
        'INSERT INTO projects ...',
        [],
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      repository.create.mockReturnValue(new Project());
      repository.save.mockRejectedValue(uniqueViolation);

      let caughtError: unknown;

      try {
        await projectsService.create(actor, input);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ConflictException);
      expect((caughtError as ConflictException).getResponse()).toEqual({
        code: 'PROJECT_KEY_ALREADY_EXISTS',
        message: 'Mã project đã tồn tại',
      });
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('preserves non-unique database failures', async () => {
      const databaseError = new Error('database unavailable');

      repository.create.mockReturnValue(new Project());
      repository.save.mockRejectedValue(databaseError);

      await expect(projectsService.create(actor, input)).rejects.toBe(
        databaseError,
      );
    });
  });

  describe('findAll', () => {
    function createLoadedProject(overrides: Partial<Project> = {}): Project {
      const owner = Object.assign(new User(), {
        id: actor.userId,
        displayName: 'Nguyen Van A',
      });

      return Object.assign(new Project(), {
        id: '22222222-2222-4222-8222-222222222222',
        key: 'K2H',
        name: 'Project Management K2H',
        description: null,
        ownerId: owner.id,
        owner,
        status: ProjectStatus.Planning,
        startDate: null,
        endDate: null,
        archivedAt: null,
        deletedAt: null,
        createdAt: new Date('2026-10-15T10:00:00.000Z'),
        updatedAt: new Date('2026-10-16T10:00:00.000Z'),
        ...overrides,
      });
    }

    it('lists only current projects owned by a USER with pagination metadata', async () => {
      const project = createLoadedProject();
      const query: ListProjectsQueryDto = {
        page: 2,
        limit: 10,
        view: ProjectListView.Current,
      };

      queryBuilder.getManyAndCount.mockResolvedValue([[project], 21]);

      const result = await projectsService.findAll(actor, query);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('project');
      expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
        'project.owner',
        'owner',
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.ownerId = :ownerId',
        { ownerId: actor.userId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.archivedAt IS NULL',
      );
      expect(queryBuilder.withDeleted).not.toHaveBeenCalled();
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'project.updatedAt',
        'DESC',
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('ownerId');
    });

    it('allows an ADMIN to list archived projects from every owner', async () => {
      const adminActor: AuthenticatedPrincipal = {
        ...actor,
        role: UserRole.Admin,
      };
      const query: ListProjectsQueryDto = {
        page: 1,
        limit: 20,
        view: ProjectListView.Archived,
      };

      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await projectsService.findAll(adminActor, query);

      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        'project.ownerId = :ownerId',
        expect.anything(),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.archivedAt IS NOT NULL',
      );
    });

    it('rejects the deleted view for a non-ADMIN before querying', async () => {
      const query: ListProjectsQueryDto = {
        page: 1,
        limit: 20,
        view: ProjectListView.Deleted,
      };

      let caughtError: unknown;

      try {
        await projectsService.findAll(actor, query);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect((caughtError as ForbiddenException).getResponse()).toEqual({
        code: 'PROJECT_DELETED_VIEW_FORBIDDEN',
        message: 'Chỉ ADMIN được xem project đã xóa',
      });
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('uses an explicit deleted scope for the ADMIN deleted view', async () => {
      const adminActor: AuthenticatedPrincipal = {
        ...actor,
        role: UserRole.Admin,
      };
      const query: ListProjectsQueryDto = {
        page: 1,
        limit: 20,
        view: ProjectListView.Deleted,
      };

      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await projectsService.findAll(adminActor, query);

      expect(queryBuilder.withDeleted).toHaveBeenCalledTimes(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.deletedAt IS NOT NULL',
      );
    });

    it('filters status and passes escaped wildcard search as a parameter', async () => {
      const query: ListProjectsQueryDto = {
        page: 1,
        limit: 20,
        search: '50%_done',
        status: ProjectStatus.Active,
        view: ProjectListView.Current,
      };

      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await projectsService.findAll(actor, query);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.status = :status',
        { status: ProjectStatus.Active },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(':search'),
        { search: '%50\\%\\_done%' },
      );
      const searchSql = queryBuilder.andWhere.mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes(':search'),
      )?.[0] as string | undefined;

      expect(searchSql).not.toContain('50%_done');
    });
  });
});
