import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from './api/auth-api';
import { AppRoot } from './AppRoot';

vi.mock('./api/auth-api', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('AppRoot', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('shows login after bootstrap finds no active session', async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('No session'));

    render(<AppRoot />);

    expect(
      screen.getByText('Đang kiểm tra phiên đăng nhập...'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Đăng nhập' }),
    ).toBeInTheDocument();
  });

  it('shows the project overview after bootstrap restores a session', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        displayName: 'Nguyen Van A',
        role: 'USER',
      },
      accessToken: 'signed-access-token',
      accessTokenExpiresIn: 900,
    });

    render(<AppRoot />);

    expect(
      await screen.findByRole('heading', { name: 'Tổng quan' }),
    ).toBeInTheDocument();
  });
});
