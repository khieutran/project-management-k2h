import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import App from './App';
import { AuthContext, type AuthContextValue } from './auth/auth-context';
import type { AuthState } from './auth/auth.types';
import { AuthenticatedQueryBoundary } from './query/AuthenticatedQueryBoundary';

function renderApp(state: AuthState, initialPath: string) {
  const auth: AuthContextValue = {
    state,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    request: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
    }),
  };

  return render(
    <AuthContext.Provider value={auth}>
      <AuthenticatedQueryBoundary>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </AuthenticatedQueryBoundary>
    </AuthContext.Provider>,
  );
}

describe('App routes', () => {
  it('renders the registration page for a guest', () => {
    renderApp({ status: 'unauthenticated' }, '/register');

    expect(
      screen.getByRole('heading', { name: 'Tạo tài khoản' }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown guest route to login', () => {
    renderApp({ status: 'unauthenticated' }, '/missing');

    expect(
      screen.getByRole('heading', { name: 'Đăng nhập' }),
    ).toBeInTheDocument();
  });

  it('renders the project overview for an authenticated user', () => {
    renderApp(
      {
        status: 'authenticated',
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'user@example.com',
          displayName: 'Nguyen Van A',
          role: 'USER',
        },
      },
      '/',
    );

    expect(
      screen.getByRole('heading', { name: 'Tổng quan' }),
    ).toBeInTheDocument();
  });
});
