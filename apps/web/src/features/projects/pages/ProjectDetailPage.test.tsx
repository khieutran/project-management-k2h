import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Admin viewer')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Thành viên' }),
    ).toBeInTheDocument();
  });
});
