import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProjectForm } from './ProjectForm';

describe('ProjectForm', () => {
  it('preserves a key after the user edits it manually', async () => {
    const user = userEvent.setup();
    render(<ProjectForm mode="create" onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText('Tên dự án'), 'Quản lý công việc');
    expect(screen.getByLabelText('Mã dự án')).toHaveValue('QLCV');

    await user.clear(screen.getByLabelText('Mã dự án'));
    await user.type(screen.getByLabelText('Mã dự án'), 'CUSTOM');
    await user.type(screen.getByLabelText('Tên dự án'), ' mới');

    expect(screen.getByLabelText('Mã dự án')).toHaveValue('CUSTOM');
  });
});
