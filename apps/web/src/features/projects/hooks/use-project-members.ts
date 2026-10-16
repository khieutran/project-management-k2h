import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../../auth/use-auth';
import { createProjectMembersApi } from '../api/project-members-api';
import { projectQueryKeys } from '../project-query-keys';

export function useProjectMembers(projectId: string) {
  const { state, request } = useAuth();
  const actorUserId = state.status === 'authenticated' ? state.user.id : '';
  const api = useMemo(() => createProjectMembersApi(request), [request]);

  return useQuery({
    queryKey: projectQueryKeys.members(actorUserId, projectId),
    queryFn: () => api.list(projectId),
    enabled: Boolean(actorUserId && projectId),
  });
}
