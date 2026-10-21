import type { ApiClient } from '../../api/api-client';
import type { CreateWorkItemInput, UpdateWorkItemInput, WorkItem } from './work-item.types';

type Request = ApiClient['request'];

export function createWorkItemsApi(request: Request) {
  return {
    list(projectId: string, includeDeleted = false): Promise<WorkItem[]> {
      return request(`/projects/${projectId}/work-items${includeDeleted ? '?includeDeleted=true' : ''}`, { authenticated: true });
    },
    detail(projectId: string, itemId: string, includeDeleted = false): Promise<WorkItem> {
      return request(`/projects/${projectId}/work-items/${itemId}${includeDeleted ? '?includeDeleted=true' : ''}`, { authenticated: true });
    },
    create(projectId: string, input: CreateWorkItemInput): Promise<WorkItem> {
      return request(`/projects/${projectId}/work-items`, {
        authenticated: true, method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
    },
    update(projectId: string, itemId: string, input: UpdateWorkItemInput): Promise<WorkItem> {
      return request(`/projects/${projectId}/work-items/${itemId}`, {
        authenticated: true, method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
    },
    remove(projectId: string, itemId: string): Promise<void> {
      return request(`/projects/${projectId}/work-items/${itemId}`, { authenticated: true, method: 'DELETE' });
    },
  };
}
