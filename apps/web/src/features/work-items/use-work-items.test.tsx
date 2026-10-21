import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { useWorkItemMutations } from './use-work-items';

describe('useWorkItemMutations', () => {
  it('invalidates both shelf and detail after editing an item', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const request = vi.fn().mockResolvedValue({ id: 'item-1' });
    const auth: AuthContextValue = {
      state: { status: 'authenticated', user: { id: 'actor-1', email: 'a@b.com', displayName: 'Actor', role: 'USER' } },
      login: vi.fn(), register: vi.fn(), logout: vi.fn(), request,
    };
    const wrapper = ({ children }: PropsWithChildren) => <AuthContext.Provider value={auth}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></AuthContext.Provider>;
    const listKey = ['work-items', 'actor-1', 'project-1', false];
    const detailKey = ['work-items', 'actor-1', 'project-1', 'item-1', false];
    queryClient.setQueryData(listKey, []);
    queryClient.setQueryData(detailKey, { id: 'item-1' });
    const { result } = renderHook(() => useWorkItemMutations('project-1'), { wrapper });

    await act(async () => {
      await result.current.update.mutateAsync({ itemId: 'item-1', input: { status: 'DONE' } });
    });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    queryClient.clear();
  });
});
