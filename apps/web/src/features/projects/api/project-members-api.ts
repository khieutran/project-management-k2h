import type { ApiClient } from '../../../api/api-client';
import type {
  AddProjectMemberInput,
  ChangeProjectMemberRoleInput,
  ProjectMember,
  ProjectMembersResponse,
} from '../project.types';

type Request = ApiClient['request'];

function jsonOptions(
  method: 'POST' | 'PATCH',
  body: unknown,
): RequestInit & { authenticated: true } {
  return {
    authenticated: true,
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function createProjectMembersApi(request: Request) {
  return {
    list(projectId: string): Promise<ProjectMembersResponse> {
      return request(`/projects/${projectId}/members`, {
        authenticated: true,
      });
    },

    add(
      projectId: string,
      input: AddProjectMemberInput,
    ): Promise<ProjectMember> {
      return request(
        `/projects/${projectId}/members`,
        jsonOptions('POST', input),
      );
    },

    changeRole(
      projectId: string,
      userId: string,
      input: ChangeProjectMemberRoleInput,
    ): Promise<ProjectMember> {
      return request(
        `/projects/${projectId}/members/${userId}`,
        jsonOptions('PATCH', input),
      );
    },

    remove(projectId: string, userId: string): Promise<void> {
      return request(`/projects/${projectId}/members/${userId}`, {
        authenticated: true,
        method: 'DELETE',
      });
    },

    leave(projectId: string): Promise<void> {
      return request(`/projects/${projectId}/members/me`, {
        authenticated: true,
        method: 'DELETE',
      });
    },
  };
}

export type ProjectMembersApi = ReturnType<typeof createProjectMembersApi>;
