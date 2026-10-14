import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../../auth/use-auth';
import { createProjectsApi } from '../api/projects-api';
import { projectQueryKeys } from '../project-query-keys';
import type { ProjectListQuery } from '../project.types';

export function useProjects(query: ProjectListQuery) {
  const { state, request } = useAuth();
  const actorUserId = state.status === 'authenticated' ? state.user.id : '';
  const api = useMemo(() => createProjectsApi(request), [request]);

  return useQuery({
    queryKey: projectQueryKeys.list(actorUserId, query),
    queryFn: () => api.list(query),
    enabled: Boolean(actorUserId),
  });
}

export function useProject(projectId: string, includeDeleted = false) {
  const { state, request } = useAuth();
  const actorUserId = state.status === 'authenticated' ? state.user.id : '';
  const api = useMemo(() => createProjectsApi(request), [request]);

  return useQuery({
    queryKey: projectQueryKeys.detail(actorUserId, projectId, includeDeleted),
    queryFn: () => api.detail(projectId, includeDeleted),
    enabled: Boolean(actorUserId && projectId),
  });
}
