import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '../api/auth-api';
import { AuthProvider } from './AuthProvider';
import type { AuthResponse } from './auth.types';
import { useAuth } from './use-auth';

vi.mock('../api/auth-api', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

const mockedAuthApi = vi.mocked(authApi);

const authResponse: AuthResponse = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    displayName: 'Nguyen Van A',
    role: 'USER',
  },
  accessToken: 'signed-access-token',
  accessTokenExpiresIn: 900,
};

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <span>{auth.state.status}</span>
      {auth.state.status === 'authenticated' && (
        <span>{auth.state.user.email}</span>
      )}
      <button
        type="button"
        onClick={() =>
          void auth.login({
            email: 'user@example.com',
            password: 'password-123',
          })
        }
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => void auth.logout().catch(() => undefined)}
      >
        Logout
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores an authenticated session during bootstrap', async () => {
    mockedAuthApi.refresh.mockResolvedValue(authResponse);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('initializing')).toBeInTheDocument();
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('shares the bootstrap refresh request in React StrictMode', async () => {
    let resolveRefresh: ((response: AuthResponse) => void) | undefined;

    mockedAuthApi.refresh.mockImplementation(
      () =>
        new Promise<AuthResponse>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    render(
      <StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(mockedAuthApi.refresh).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveRefresh?.(authResponse);
    });

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
  });

  it('becomes unauthenticated when bootstrap refresh fails', async () => {
    mockedAuthApi.refresh.mockRejectedValue(new Error('No session'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
  });

  it('stores a successful login session in provider state', async () => {
    mockedAuthApi.refresh.mockRejectedValue(new Error('No session'));
    mockedAuthApi.login.mockResolvedValue(authResponse);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await screen.findByText('unauthenticated');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByRole('status', { name: 'Đang vào bãi dự án' })).toBeInTheDocument();
    expect(screen.getByText('unauthenticated')).toBeInTheDocument();
    expect(await screen.findByText('authenticated', {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Đang vào bãi dự án' })).not.toBeInTheDocument();
    }, { timeout: 3000 });
    expect(mockedAuthApi.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password-123',
    });
  });

  it('clears local authentication even when logout request fails', async () => {
    mockedAuthApi.refresh.mockResolvedValue(authResponse);
    mockedAuthApi.logout.mockRejectedValue(new Error('Network unavailable'));
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await screen.findByText('authenticated');
    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
  });

  it('rejects useAuth outside AuthProvider', () => {
    expect(() => render(<AuthProbe />)).toThrow(
      'useAuth must be used within AuthProvider',
    );
  });
});
