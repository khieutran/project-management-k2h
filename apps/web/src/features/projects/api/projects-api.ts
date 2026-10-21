import type { ApiClient } from '../../../api/api-client';
import type {
  CreateProjectInput,
  PaginatedProjects,
  Project,
  ProjectListQuery,
  ProjectStatus,
  UpdateProjectInput,
} from '../project.types';

type Request = ApiClient['request'];

function jsonOptions(method: 'POST' | 'PATCH', body?: unknown): RequestInit & {
  authenticated: true;
} {
  return {
    authenticated: true,
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

export function createProjectsApi(request: Request) {
  return {
    list(query: ProjectListQuery): Promise<PaginatedProjects> {
      const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
      });
      if (query.search) params.set('search', query.search);
      if (query.status) params.set('status', query.status);
      params.set('view', query.view);
      if (query.sort) params.set('sort', query.sort);

      return request(`/projects?${params.toString()}`, {
        authenticated: true,
      });
    },

    detail(projectId: string, includeDeleted = false): Promise<Project> {
      const suffix = includeDeleted ? '?includeDeleted=true' : '';
      return request(`/projects/${projectId}${suffix}`, {
        authenticated: true,
      });
    },

    create(input: CreateProjectInput): Promise<Project> {
      return request('/projects', jsonOptions('POST', input));
    },

    update(projectId: string, input: UpdateProjectInput): Promise<Project> {
      return request(`/projects/${projectId}`, jsonOptions('PATCH', input));
    },

    changeStatus(projectId: string, status: ProjectStatus): Promise<Project> {
      return request(
        `/projects/${projectId}/status`,
        jsonOptions('PATCH', { status }),
      );
    },

    archive(projectId: string): Promise<Project> {
      return request(`/projects/${projectId}/archive`, jsonOptions('POST'));
    },

    restore(projectId: string): Promise<Project> {
      return request(`/projects/${projectId}/restore`, jsonOptions('POST'));
    },

    delete(projectId: string): Promise<void> {
      return request(`/projects/${projectId}`, {
        authenticated: true,
        method: 'DELETE',
      });
    },
  };
}

export type ProjectsApi = ReturnType<typeof createProjectsApi>;
