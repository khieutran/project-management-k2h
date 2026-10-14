import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../auth/auth-context';
import { useProjectMutations } from '../hooks/use-project-mutations';
import { useProject } from '../hooks/use-projects';
import { EditProjectPage } from './EditProjectPage';

vi.mock('../hooks/use-projects', () => ({ useProject: vi.fn() }));
vi.mock('../hooks/use-project-mutations', () => ({ useProjectMutations: vi.fn() }));

describe('EditProjectPage', () => {
  it('sends null when optional fields are cleared', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'p1' });
    vi.mocked(useProjectMutations).mockReturnValue({ updateProject: { mutateAsync, isPending: false } } as unknown as ReturnType<typeof useProjectMutations>);
    vi.mocked(useProject).mockReturnValue({ data: { id: 'p1', key: 'K2H', name: 'Project K2H', description: 'Old', status: 'PLANNING', startDate: '2026-10-15', endDate: null, archivedAt: null, deletedAt: null, owner: { id: 'u1', displayName: 'Khiếu' }, createdAt: '', updatedAt: '' }, isPending: false, isError: false } as unknown as ReturnType<typeof useProject>);
    const auth: AuthContextValue = { state: { status: 'authenticated', user: { id: 'u1', email: 'a@b.com', displayName: 'Khiếu', role: 'USER' } }, login: vi.fn(), register: vi.fn(), logout: vi.fn(), request: vi.fn() };
    const user = userEvent.setup();
    render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={['/projects/p1/edit']}><Routes><Route path="/projects/:projectId/edit" element={<EditProjectPage />} /><Route path="/projects/:projectId" element={<h1>Detail</h1>} /></Routes></MemoryRouter></AuthContext.Provider>);

    await user.clear(screen.getByLabelText('Mô tả'));
    await user.clear(screen.getByLabelText('Ngày bắt đầu'));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(mutateAsync).toHaveBeenCalledWith({ projectId: 'p1', input: expect.objectContaining({ description: null, startDate: null, endDate: null }) });
  });
});
