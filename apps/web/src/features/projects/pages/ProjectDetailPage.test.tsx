import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../auth/auth-context';
import { useProjectMembers } from '../hooks/use-project-members';
import { useProject } from '../hooks/use-projects';
import { ProjectDetailPage } from './ProjectDetailPage';

vi.mock('../hooks/use-projects', () => ({ useProject: vi.fn() }));
vi.mock('../hooks/use-project-members', () => ({
  useProjectMembers: vi.fn(),
}));
vi.mock('../hooks/use-project-member-mutations', () => ({
  useProjectMemberMutations: () => ({
    addMember: { mutateAsync: vi.fn(), isPending: false },
    changeMemberRole: { mutateAsync: vi.fn(), isPending: false },
    removeMember: { mutateAsync: vi.fn(), isPending: false },
    leaveProject: { mutateAsync: vi.fn(), isPending: false },
  }),
}));
vi.mock('../hooks/use-project-mutations', () => ({
  useProjectMutations: () => ({
    changeStatus: { mutateAsync: vi.fn(), isPending: false },
    archive: { mutateAsync: vi.fn(), isPending: false },
    restore: { mutateAsync: vi.fn(), isPending: false },
    deleteProject: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

function renderDetail(actorId: string) {
  const auth: AuthContextValue = {
    state: {
      status: 'authenticated',
      user: { id: actorId, email: 'a@b.com', displayName: 'Admin', role: 'ADMIN' },
    },
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), request: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes><Route path="/projects/:projectId" element={<ProjectDetailPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProjectDetailPage', () => {
  it('puts project progress and ownership ahead of secondary actions', async () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      data: { data: [] }, isPending: false, isError: false,
    } as unknown as ReturnType<typeof useProjectMembers>);
    vi.mocked(useProject).mockReturnValue({
      data: {
        id: 'p1', key: 'WEB', name: 'Website sản phẩm',
        description: 'Chuẩn bị bản phát hành.', status: 'ACTIVE',
        startDate: '2026-10-01', endDate: '2026-11-01',
        archivedAt: null, deletedAt: null, accessRole: 'OWNER',
        owner: { id: 'owner-1', displayName: 'Hào' },
        createdAt: '2026-10-01', updatedAt: '2026-10-15',
      },
      isPending: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProject>);

    renderDetail('owner-1');

    expect(screen.getByRole('heading', { name: 'Website sản phẩm' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tiến trình dự án' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thông tin dự án' })).toBeInTheDocument();
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chỉnh sửa dự án' })).toHaveAttribute('href', '/projects/p1/edit');
    await userEvent.click(screen.getByRole('button', { name: 'Tùy chọn dự án' }));
    expect(screen.getByRole('button', { name: 'Xóa dự án' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa dự án' })).toHaveClass('danger-link');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Xóa dự án' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tùy chọn dự án' }));
    await userEvent.click(screen.getByRole('heading', { name: 'Tiến trình dự án' }));
    expect(screen.queryByRole('button', { name: 'Xóa dự án' })).not.toBeInTheDocument();
  });

  it('keeps an ADMIN non-owner in read-only mode', () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      data: { data: [] },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectMembers>);
    vi.mocked(useProject).mockReturnValue({
      data: {
        id: 'p1', key: 'K2H', name: 'K2H', description: null,
        status: 'ACTIVE', startDate: null, endDate: null,
        archivedAt: null, deletedAt: null,
        accessRole: 'ADMIN_VIEWER',
        owner: { id: 'owner-1', displayName: 'Hào' },
        createdAt: '2026-10-15', updatedAt: '2026-10-15',
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProject>);

    renderDetail('admin-1');

    expect(screen.getByRole('heading', { name: 'K2H' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();
    expect(screen.getByText('Chế độ chỉ xem')).toBeInTheDocument();
    expect(screen.getByText('Quản trị · Chỉ xem')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Thành viên' }),
    ).toBeInTheDocument();
  });
});
