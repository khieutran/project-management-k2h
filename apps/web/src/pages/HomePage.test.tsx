import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { HomePage } from './HomePage';

function renderHome(logout: AuthContextValue['logout'] = vi.fn()) {
  const auth: AuthContextValue = {
    state: {
      status: 'authenticated',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        displayName: 'Nguyen Van A',
        role: 'USER',
      },
    },
    login: vi.fn(),
    register: vi.fn(),
    logout,
    request: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('HomePage', () => {
  it('shows only safe account information', () => {
    renderHome();

    expect(screen.getByText('Xin chào, Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('USER')).toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });

  it('prevents repeated logout while the request is pending', async () => {
    const logout = vi.fn(() => new Promise<void>(() => undefined));
    const user = userEvent.setup();
    renderHome(logout);

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    const pendingButton = screen.getByRole('button', {
      name: 'Đang đăng xuất...',
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
