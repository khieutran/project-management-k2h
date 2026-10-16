import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../auth/auth-context';
import { projectQueryKeys } from '../project-query-keys';
import type { ProjectListQuery } from '../project.types';
import { useProjectMemberMutations } from './use-project-member-mutations';

const actorUserId = 'actor-1';
const otherActorUserId = 'actor-2';
const projectId = 'project-1';
const listQuery: ProjectListQuery = {
  page: 1,
  limit: 20,
  view: 'current',
};

function createTestContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const request = vi.fn().mockResolvedValue(undefined);
  const auth: AuthContextValue = {
    state: {
      status: 'authenticated',
      user: {
        id: actorUserId,
        email: 'actor@example.com',
        displayName: 'Actor',
        role: 'USER',
      },
    },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    request,
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </AuthContext.Provider>
  );

  return { queryClient, wrapper };
}

function seedProjectQueries(queryClient: QueryClient) {
  queryClient.setQueryData(
    projectQueryKeys.list(actorUserId, listQuery),
    { data: [] },
  );
  queryClient.setQueryData(
    projectQueryKeys.detail(actorUserId, projectId),
    { id: projectId },
  );
  queryClient.setQueryData(
    projectQueryKeys.members(actorUserId, projectId),
    { data: [] },
  );
  queryClient.setQueryData(
    projectQueryKeys.members(otherActorUserId, projectId),
    { data: [] },
  );
}

function expectCurrentActorQueriesInvalidated(queryClient: QueryClient) {
  expect(
    queryClient.getQueryState(projectQueryKeys.list(actorUserId, listQuery))
      ?.isInvalidated,
  ).toBe(true);
  expect(
    queryClient.getQueryState(projectQueryKeys.detail(actorUserId, projectId))
      ?.isInvalidated,
  ).toBe(true);
  expect(
    queryClient.getQueryState(projectQueryKeys.members(actorUserId, projectId))
      ?.isInvalidated,
  ).toBe(true);
  expect(
    queryClient.getQueryState(
      projectQueryKeys.members(otherActorUserId, projectId),
    )?.isInvalidated,
  ).toBe(false);
}

describe('useProjectMemberMutations', () => {
  it.each(['add', 'changeRole', 'remove', 'leave'] as const)(
    'invalidates current actor project queries after %s succeeds',
    async (actionName) => {
      const { queryClient, wrapper } = createTestContext();
      seedProjectQueries(queryClient);
      const { result } = renderHook(() => useProjectMemberMutations(), {
        wrapper,
      });

      await act(async () => {
        switch (actionName) {
          case 'add':
            await result.current.addMember.mutateAsync({
              projectId,
              input: {
                email: 'member@example.com',
                role: 'MEMBER',
              },
            });
            break;
          case 'changeRole':
            await result.current.changeMemberRole.mutateAsync({
              projectId,
              userId: 'member-1',
              input: { role: 'MANAGER' },
            });
            break;
          case 'remove':
            await result.current.removeMember.mutateAsync({
              projectId,
              userId: 'member-1',
            });
            break;
          case 'leave':
            await result.current.leaveProject.mutateAsync(projectId);
            break;
        }
      });

      expectCurrentActorQueriesInvalidated(queryClient);
      queryClient.clear();
    },
  );
});
