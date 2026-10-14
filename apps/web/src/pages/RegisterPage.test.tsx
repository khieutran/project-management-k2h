import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { RegisterPage } from './RegisterPage';

function renderRegister(
  register: AuthContextValue['register'] = vi.fn().mockResolvedValue(undefined),
) {
  const auth: AuthContextValue = {
    state: { status: 'unauthenticated' },
    login: vi.fn(),
    register,
    logout: vi.fn(),
    request: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<h1>Authenticated home</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tên hiển thị'), ' Nguyen Van A ');
  await user.type(screen.getByLabelText('Email'), ' User@Example.com ');
  await user.type(screen.getByLabelText('Mật khẩu'), ' password-123 ');
  await user.type(
    screen.getByLabelText('Xác nhận mật khẩu'),
    ' password-123 ',
  );
}

describe('RegisterPage', () => {
  it('shows field errors for invalid registration data', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('Tên hiển thị'), '   ');
    await user.type(screen.getByLabelText('Email'), 'invalid-email');
    await user.type(screen.getByLabelText('Mật khẩu'), 'short');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'different');
    await user.tab();

    expect(screen.getByText('Tên hiển thị không được để trống')).toBeInTheDocument();
    expect(screen.getByText('Email không đúng định dạng')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu phải có từ 10 đến 128 ký tự')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeDisabled();
  });

  it('registers safe input without sending confirmation or role', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegister(register);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText('Authenticated home')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith({
      displayName: 'Nguyen Van A',
      email: 'user@example.com',
      password: ' password-123 ',
    });
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
  });

  it('shows a specific message when the email already exists', async () => {
    const register = vi.fn().mockRejectedValue(
      new ApiError(
        409,
        'AUTH_EMAIL_ALREADY_EXISTS',
        'Email đã được sử dụng',
      ),
    );
    const user = userEvent.setup();
    renderRegister(register);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByText('Email này đã được sử dụng'),
    ).toBeInTheDocument();
  });

  it('prevents duplicate submission while registration is pending', async () => {
    const register = vi.fn(() => new Promise<void>(() => undefined));
    const user = userEvent.setup();
    renderRegister(register);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    const pendingButton = screen.getByRole('button', {
      name: 'Đang tạo tài khoản...',
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(register).toHaveBeenCalledTimes(1);
  });
});
