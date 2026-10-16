import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../../auth/use-auth';
import { createProjectMembersApi } from '../api/project-members-api';
import { projectQueryKeys } from '../project-query-keys';
import type {
  AddProjectMemberInput,
  ChangeProjectMemberRoleInput,
} from '../project.types';

type AddMemberVariables = {
  projectId: string;
  input: AddProjectMemberInput;
};

type ChangeMemberRoleVariables = {
  projectId: string;
  userId: string;
  input: ChangeProjectMemberRoleInput;
};

type RemoveMemberVariables = {
  projectId: string;
  userId: string;
};

export function useProjectMemberMutations() {
  const { state, request } = useAuth();
  const queryClient = useQueryClient();
  const actorUserId = state.status === 'authenticated' ? state.user.id : '';
  const api = useMemo(() => createProjectMembersApi(request), [request]);
  const refreshCurrentActorProjects = () =>
    queryClient.invalidateQueries({
      queryKey: projectQueryKeys.all(actorUserId),
    });

  return {
    addMember: useMutation({
      mutationFn: ({ projectId, input }: AddMemberVariables) =>
        api.add(projectId, input),
      onSuccess: refreshCurrentActorProjects,
    }),
    changeMemberRole: useMutation({
      mutationFn: ({
        projectId,
        userId,
        input,
      }: ChangeMemberRoleVariables) => api.changeRole(projectId, userId, input),
      onSuccess: refreshCurrentActorProjects,
    }),
    removeMember: useMutation({
      mutationFn: ({ projectId, userId }: RemoveMemberVariables) =>
        api.remove(projectId, userId),
      onSuccess: refreshCurrentActorProjects,
    }),
    leaveProject: useMutation({
      mutationFn: (projectId: string) => api.leave(projectId),
      onSuccess: refreshCurrentActorProjects,
    }),
  };
}
