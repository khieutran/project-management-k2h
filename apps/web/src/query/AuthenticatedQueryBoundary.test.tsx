import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { AuthenticatedQueryBoundary } from './AuthenticatedQueryBoundary';

function CacheProbe() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(
      ['projects', 'user-1', 'list', { view: 'current' }],
      ['private-project'],
    );
    queryClient.setQueryData(
      ['projects', 'user-1', 'detail', 'project-1'],
      { id: 'project-1' },
    );
    queryClient.setQueryData(
      ['projects', 'user-1', 'members', 'project-1'],
      ['private-member'],
    );
    queryClient.setQueryData(['health'], { status: 'ok' });
  }, [queryClient]);

  return (
    <button
      type="button"
      onClick={() => {
        const oldList = queryClient.getQueryData([
          'projects',
          'user-1',
          'list',
          { view: 'current' },
        ]);
        const oldDetail = queryClient.getQueryData([
          'projects',
          'user-1',
          'detail',
          'project-1',
        ]);
        const oldMembers = queryClient.getQueryData([
          'projects',
          'user-1',
          'members',
          'project-1',
        ]);
        const publicHealth = queryClient.getQueryData(['health']);
        screen.getByTestId('cache').textContent = JSON.stringify({
          oldList,
          oldDetail,
          oldMembers,
          publicHealth,
        });
      }}
    >
      Read cache
    </button>
  );
}

function authValue(userId?: string): AuthContextValue {
  return {
    state: userId
      ? {
          status: 'authenticated',
          user: {
            id: userId,
            displayName: 'Khiếu',
            email: 'khieu@example.com',
            role: 'USER',
          },
        }
      : { status: 'unauthenticated' },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    request: vi.fn(),
  };
}

describe('AuthenticatedQueryBoundary', () => {
  it('removes project cache when authenticated identity changes', async () => {
    const view = render(
      <AuthContext.Provider value={authValue('user-1')}>
        <AuthenticatedQueryBoundary>
          <CacheProbe />
          <output data-testid="cache" />
        </AuthenticatedQueryBoundary>
      </AuthContext.Provider>,
    );

    view.rerender(
      <AuthContext.Provider value={authValue('user-2')}>
        <AuthenticatedQueryBoundary>
          <CacheProbe />
          <output data-testid="cache" />
        </AuthenticatedQueryBoundary>
      </AuthContext.Provider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Read cache' }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('cache')).toHaveTextContent(
        '{"publicHealth":{"status":"ok"}}',
      ),
    );
  });
});
