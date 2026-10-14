import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
import {
  type ListProjectsQueryDto,
  ProjectListView,
} from './dto/list-projects-query.dto';
import { ProjectStatus } from './enums/project-status.enum';
import { ProjectsController } from './projects.controller';
import type { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  let projectsService: {
    create: jest.Mock;
    findAll: jest.Mock;
  };
  let projectsController: ProjectsController;

  beforeEach(() => {
    projectsService = {
      create: jest.fn(),
      findAll: jest.fn(),
    };
    projectsController = new ProjectsController(
      projectsService as unknown as ProjectsService,
    );
  });

  describe('create', () => {
    it('uses the authenticated principal and returns the service response', async () => {
      const request = {
        user: {
          userId: '11111111-1111-4111-8111-111111111111',
          sessionId: '99999999-9999-4999-8999-999999999999',
          role: UserRole.User,
        },
      } as AuthenticatedRequest;
      const input: CreateProjectDto = {
        key: 'K2H',
        name: 'Project Management K2H',
      };
      const response = {
        id: '22222222-2222-4222-8222-222222222222',
        key: input.key,
        name: input.name,
        description: null,
        status: ProjectStatus.Planning,
        startDate: null,
        endDate: null,
        archivedAt: null,
        deletedAt: null,
        owner: {
          id: request.user.userId,
          displayName: 'Nguyen Van A',
        },
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-15T10:00:00.000Z',
      };

      projectsService.create.mockResolvedValue(response);

      const result = await projectsController.create(request, input);

      expect(projectsService.create).toHaveBeenCalledWith(request.user, input);
      expect(result).toBe(response);
    });
  });

  describe('findAll', () => {
    it('passes the authenticated principal and validated query to the service', async () => {
      const request = {
        user: {
          userId: '11111111-1111-4111-8111-111111111111',
          sessionId: '99999999-9999-4999-8999-999999999999',
          role: UserRole.User,
        },
      } as AuthenticatedRequest;
      const query: ListProjectsQueryDto = {
        page: 1,
        limit: 20,
        search: 'K2H',
        status: ProjectStatus.Active,
        view: ProjectListView.Current,
      };
      const response = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      projectsService.findAll.mockResolvedValue(response);

      const result = await projectsController.findAll(request, query);

      expect(projectsService.findAll).toHaveBeenCalledWith(request.user, query);
      expect(result).toBe(response);
    });
  });
});
