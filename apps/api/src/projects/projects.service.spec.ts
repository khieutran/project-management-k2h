import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  type EntityManager,
  QueryFailedError,
  type Repository,
} from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ChangeProjectStatusDto } from './dto/change-project-status.dto';
import {
  type ListProjectsQueryDto,
  ProjectListView,
} from './dto/list-projects-query.dto';
import { Project } from './entities/project.entity';
import { ProjectStatus } from './enums/project-status.enum';
import type { UpdateProjectDto } from './dto/update-project.dto';
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
    getOne: jest.Mock;
    setLock: jest.Mock;
  };
  let transactionQueryBuilder: {
    innerJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let transactionRepository: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let entityManager: {
    getRepository: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
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
      getOne: jest.fn(),
      setLock: jest.fn().mockReturnThis(),
    };
    transactionQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    transactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(transactionQueryBuilder),
      save: jest.fn(),
    };
    entityManager = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    };
    dataSource = {
      transaction: jest.fn(
        async (operation: (manager: EntityManager) => Promise<unknown>) =>
          operation(entityManager as unknown as EntityManager),
      ),
    };
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    projectsService = new ProjectsService(
      repository as unknown as Repository<Project>,
      dataSource as unknown as DataSource,
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

  describe('findOne', () => {
    it('scopes a USER detail query by ownership', async () => {
      const project = createProjectFixture();

      queryBuilder.getOne.mockResolvedValue(project);

      const result = await projectsService.findOne(actor, project.id, {
        includeDeleted: false,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.id = :projectId',
        { projectId: project.id },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.ownerId = :ownerId',
        { ownerId: actor.userId },
      );
      expect(queryBuilder.withDeleted).not.toHaveBeenCalled();
      expect(result.id).toBe(project.id);
    });

    it('allows an ADMIN to read another owner project', async () => {
      const adminActor = { ...actor, role: UserRole.Admin };
      const project = createProjectFixture({
        ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });

      queryBuilder.getOne.mockResolvedValue(project);

      await projectsService.findOne(adminActor, project.id, {
        includeDeleted: false,
      });

      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        'project.ownerId = :ownerId',
        expect.anything(),
      );
    });

    it('returns the same not-found error for missing and out-of-scope projects', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        projectsService.findOne(actor, '22222222-2222-4222-8222-222222222222', {
          includeDeleted: false,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows only an ADMIN to include soft-deleted projects', async () => {
      const project = createProjectFixture({
        deletedAt: new Date('2026-11-01T00:00:00.000Z'),
      });
      const adminActor = { ...actor, role: UserRole.Admin };

      queryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectsService.findOne(actor, project.id, { includeDeleted: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const result = await projectsService.findOne(adminActor, project.id, {
        includeDeleted: true,
      });

      expect(queryBuilder.withDeleted).toHaveBeenCalledTimes(1);
      expect(result.deletedAt).toBe('2026-11-01T00:00:00.000Z');
    });
  });

  describe('update', () => {
    it('locks the owner-scoped row and saves through the transaction repository', async () => {
      const project = createProjectFixture();
      const update: UpdateProjectDto = { name: 'Renamed Project' };

      transactionQueryBuilder.getOne.mockResolvedValue(project);
      transactionRepository.save.mockResolvedValue(project);

      const result = await projectsService.update(actor, project.id, update);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(entityManager.getRepository).toHaveBeenCalledWith(Project);
      expect(transactionQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(transactionQueryBuilder.andWhere).toHaveBeenCalledWith(
        'project.ownerId = :ownerId',
        { ownerId: actor.userId },
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(project);
      expect(result.name).toBe('Renamed Project');
    });

    it('rejects an empty update before opening a transaction', async () => {
      await expect(
        projectsService.update(actor, 'project-id', {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects updates to archived projects', async () => {
      const project = createProjectFixture({ archivedAt: new Date() });

      transactionQueryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectsService.update(actor, project.id, { name: 'Blocked update' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('supports clearing nullable project information', async () => {
      const project = createProjectFixture({
        description: 'Old description',
        startDate: '2026-10-15',
        endDate: '2027-03-31',
      });

      transactionQueryBuilder.getOne.mockResolvedValue(project);
      transactionRepository.save.mockImplementation(async (value) => value);

      const result = await projectsService.update(actor, project.id, {
        description: null,
        startDate: null,
        endDate: null,
      });

      expect(result.description).toBeNull();
      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
    });

    it('validates a partial date update against the persisted other date', async () => {
      const project = createProjectFixture({
        startDate: '2026-10-15',
        endDate: '2026-12-31',
      });

      transactionQueryBuilder.getOne.mockResolvedValue(project);

      let caughtError: unknown;

      try {
        await projectsService.update(actor, project.id, {
          startDate: '2027-01-01',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ConflictException);
      expect((caughtError as ConflictException).getResponse()).toEqual({
        code: 'PROJECT_INVALID_DATE_RANGE',
        message: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu',
      });
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it.each([
      [ProjectStatus.Planning, ProjectStatus.Active],
      [ProjectStatus.Active, ProjectStatus.Completed],
      [ProjectStatus.Completed, ProjectStatus.Active],
    ])('allows the transition %s -> %s', async (currentStatus, nextStatus) => {
      const project = createProjectFixture({ status: currentStatus });
      const input: ChangeProjectStatusDto = { status: nextStatus };

      transactionQueryBuilder.getOne.mockResolvedValue(project);
      transactionRepository.save.mockImplementation(async (value) => value);

      const result = await projectsService.changeStatus(
        actor,
        project.id,
        input,
      );

      expect(result.status).toBe(nextStatus);
      expect(transactionQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(project);
    });

    it.each([
      [ProjectStatus.Planning, ProjectStatus.Planning],
      [ProjectStatus.Planning, ProjectStatus.Completed],
      [ProjectStatus.Active, ProjectStatus.Planning],
    ])('rejects the transition %s -> %s', async (currentStatus, nextStatus) => {
      const project = createProjectFixture({ status: currentStatus });

      transactionQueryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectsService.changeStatus(actor, project.id, { status: nextStatus }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects lifecycle changes for an archived project', async () => {
      const project = createProjectFixture({ archivedAt: new Date() });

      transactionQueryBuilder.getOne.mockResolvedValue(project);

      await expect(
        projectsService.changeStatus(actor, project.id, {
          status: ProjectStatus.Active,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('archive, restore, and delete', () => {
    it('archives once without changing lifecycle status', async () => {
      const project = createProjectFixture({ status: ProjectStatus.Active });

      transactionQueryBuilder.getOne.mockResolvedValue(project);
      transactionRepository.save.mockImplementation(async (value) => value);

      const result = await projectsService.archive(actor, project.id);

      expect(result.archivedAt).toEqual(expect.any(String));
      expect(result.status).toBe(ProjectStatus.Active);
      expect(transactionRepository.save).toHaveBeenCalledTimes(1);
    });

    it('treats archiving an archived project as idempotent', async () => {
      const archivedAt = new Date('2026-11-01T00:00:00.000Z');
      const project = createProjectFixture({ archivedAt });

      transactionQueryBuilder.getOne.mockResolvedValue(project);

      const result = await projectsService.archive(actor, project.id);

      expect(result.archivedAt).toBe(archivedAt.toISOString());
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('restores once and treats restoring an active project as idempotent', async () => {
      const archivedProject = createProjectFixture({ archivedAt: new Date() });

      transactionQueryBuilder.getOne.mockResolvedValueOnce(archivedProject);
      transactionRepository.save.mockImplementation(async (value) => value);

      const restored = await projectsService.restore(actor, archivedProject.id);

      expect(restored.archivedAt).toBeNull();
      expect(transactionRepository.save).toHaveBeenCalledTimes(1);

      transactionRepository.save.mockClear();
      transactionQueryBuilder.getOne.mockResolvedValueOnce(
        createProjectFixture(),
      );

      await projectsService.restore(actor, archivedProject.id);

      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('soft deletes an owned project directly without requiring archive', async () => {
      const project = createProjectFixture({
        status: ProjectStatus.Active,
        archivedAt: null,
      });

      transactionQueryBuilder.getOne.mockResolvedValue(project);
      transactionRepository.save.mockImplementation(async (value) => value);

      await projectsService.delete(actor, project.id);

      expect(project.deletedAt).toEqual(expect.any(Date));
      expect(project.status).toBe(ProjectStatus.Active);
      expect(transactionRepository.save).toHaveBeenCalledWith(project);
      expect(transactionQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
    });

    it('returns not found when delete cannot find an owner-scoped active row', async () => {
      transactionQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        projectsService.delete(actor, '22222222-2222-4222-8222-222222222222'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });
  });
});

function createProjectFixture(overrides: Partial<Project> = {}): Project {
  const owner = Object.assign(new User(), {
    id: '11111111-1111-4111-8111-111111111111',
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
