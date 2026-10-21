import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../auth/use-auth';
import type { CreateWorkItemInput, UpdateWorkItemInput } from './work-item.types';
import { createWorkItemsApi } from './work-items-api';

function useWorkItemsContext() {
  const { state, request } = useAuth();
  const actorId = state.status === 'authenticated' ? state.user.id : '';
  const api = useMemo(() => createWorkItemsApi(request), [request]);
  return { actorId, api };
}

export function useWorkItems(projectId: string, includeDeleted = false) {
  const { actorId, api } = useWorkItemsContext();
  return useQuery({
    queryKey: ['work-items', actorId, projectId, includeDeleted],
    queryFn: () => api.list(projectId, includeDeleted),
    enabled: Boolean(actorId && projectId),
  });
}

export function useWorkItem(projectId: string, itemId: string, includeDeleted = false) {
  const { actorId, api } = useWorkItemsContext();
  return useQuery({
    queryKey: ['work-items', actorId, projectId, itemId, includeDeleted],
    queryFn: () => api.detail(projectId, itemId, includeDeleted),
    enabled: Boolean(actorId && projectId && itemId),
  });
}

export function useWorkItemMutations(projectId: string) {
  const { actorId, api } = useWorkItemsContext();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['work-items', actorId, projectId] });
  return {
    create: useMutation({ mutationFn: (input: CreateWorkItemInput) => api.create(projectId, input), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ itemId, input }: { itemId: string; input: UpdateWorkItemInput }) => api.update(projectId, itemId, input), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (itemId: string) => api.remove(projectId, itemId), onSuccess: refresh }),
  };
}
