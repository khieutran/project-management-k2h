import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../auth/auth-context';
import { useProjectMutations } from '../hooks/use-project-mutations';
import { CreateProjectPage } from './CreateProjectPage';

vi.mock('../hooks/use-project-mutations', () => ({ useProjectMutations: vi.fn() }));

const auth: AuthContextValue = {
  state: { status: 'authenticated', user: { id: 'u1', email: 'a@b.com', displayName: 'Khiếu', role: 'USER' } },
  login: vi.fn(), register: vi.fn(), logout: vi.fn(), request: vi.fn(),
};

describe('CreateProjectPage', () => {
  it('navigates to detail after creating a project', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'p1' });
    vi.mocked(useProjectMutations).mockReturnValue({
      createProject: { mutateAsync, isPending: false },
    } as unknown as ReturnType<typeof useProjectMutations>);
    const user = userEvent.setup();
    render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={['/projects/new']}><Routes><Route path="/projects/new" element={<CreateProjectPage />} /><Route path="/projects/:projectId" element={<h1>Project detail</h1>} /></Routes></MemoryRouter></AuthContext.Provider>);

    await user.type(screen.getByLabelText('Tên dự án'), 'K2H Platform');
    await user.click(screen.getByRole('button', { name: 'Tạo dự án' }));

    expect(await screen.findByRole('heading', { name: 'Project detail' })).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ key: 'KP', name: 'K2H Platform' }));
  });
});
