import type { ProjectListQuery } from './project.types';

export const projectQueryKeys = {
  all: (actorUserId: string) => ['projects', actorUserId] as const,
  list: (actorUserId: string, query: ProjectListQuery) =>
    [...projectQueryKeys.all(actorUserId), 'list', query] as const,
  detail: (
    actorUserId: string,
    projectId: string,
    includeDeleted = false,
  ) =>
    [
      ...projectQueryKeys.all(actorUserId),
      'detail',
      projectId,
      { includeDeleted },
    ] as const,
  members: (actorUserId: string, projectId: string) =>
    [...projectQueryKeys.all(actorUserId), 'members', projectId] as const,
};
