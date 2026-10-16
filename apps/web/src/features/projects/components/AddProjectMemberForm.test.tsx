import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../api/api-error';
import { AddProjectMemberForm } from './AddProjectMemberForm';

describe('AddProjectMemberForm', () => {
  it('rejects an invalid email before submitting', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AddProjectMemberForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email thành viên'), 'not-an-email');
    await user.tab();

    expect(screen.getByText('Email không đúng định dạng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm thành viên' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('normalizes the exact email and submits the selected role', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AddProjectMemberForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText('Email thành viên'),
      ' Member@Example.com ',
    );
    await user.selectOptions(screen.getByLabelText('Vai trò'), 'MANAGER');
    await user.click(screen.getByRole('button', { name: 'Thêm thành viên' }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'member@example.com',
      role: 'MANAGER',
    });
    expect(screen.getByLabelText('Email thành viên')).toHaveValue('');
  });

  it.each([
    [
      'PROJECT_MEMBER_ALREADY_EXISTS',
      409,
      'Người dùng đã là thành viên của dự án.',
    ],
    [
      'PROJECT_MEMBER_USER_NOT_FOUND',
      404,
      'Không tìm thấy tài khoản với email này.',
    ],
  ])(
    'shows a safe message for %s',
    async (code, statusCode, expectedMessage) => {
      const onSubmit = vi.fn().mockRejectedValue(
        new ApiError(statusCode, code, 'Backend internal message'),
      );
      const user = userEvent.setup();
      render(<AddProjectMemberForm onSubmit={onSubmit} />);

      await user.type(
        screen.getByLabelText('Email thành viên'),
        'member@example.com',
      );
      await user.click(
        screen.getByRole('button', { name: 'Thêm thành viên' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        expectedMessage,
      );
    },
  );

  it('prevents duplicate submissions while the request is pending', async () => {
    const onSubmit = vi.fn(() => new Promise<void>(() => undefined));
    const user = userEvent.setup();
    render(<AddProjectMemberForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText('Email thành viên'),
      'member@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Thêm thành viên' }));

    const pendingButton = screen.getByRole('button', {
      name: 'Đang thêm...',
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
