import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
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
  };
  let projectsService: ProjectsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
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
});
