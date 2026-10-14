import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../../auth/use-auth';
import { createProjectsApi } from '../api/projects-api';
import { projectQueryKeys } from '../project-query-keys';
import type { CreateProjectInput, ProjectStatus, UpdateProjectInput } from '../project.types';

export function useProjectMutations() {
  const { state, request } = useAuth();
  const queryClient = useQueryClient();
  const actorUserId = state.status === 'authenticated' ? state.user.id : '';
  const api = useMemo(() => createProjectsApi(request), [request]);
  const refreshProjects = () => queryClient.invalidateQueries({ queryKey: projectQueryKeys.all(actorUserId) });

  return {
    createProject: useMutation({ mutationFn: (input: CreateProjectInput) => api.create(input), onSuccess: refreshProjects }),
    updateProject: useMutation({ mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) => api.update(projectId, input), onSuccess: refreshProjects }),
    changeStatus: useMutation({ mutationFn: ({ projectId, status }: { projectId: string; status: ProjectStatus }) => api.changeStatus(projectId, status), onSuccess: refreshProjects }),
    archive: useMutation({ mutationFn: (projectId: string) => api.archive(projectId), onSuccess: refreshProjects }),
    restore: useMutation({ mutationFn: (projectId: string) => api.restore(projectId), onSuccess: refreshProjects }),
    deleteProject: useMutation({ mutationFn: (projectId: string) => api.delete(projectId), onSuccess: refreshProjects }),
  };
}
