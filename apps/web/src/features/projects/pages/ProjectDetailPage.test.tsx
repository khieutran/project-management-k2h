import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../auth/auth-context';
import { useProjectMembers } from '../hooks/use-project-members';
import { useProject } from '../hooks/use-projects';
import { useWorkItem, useWorkItems, useWorkItemMutations } from '../../work-items/use-work-items';
import { ProjectDetailPage } from './ProjectDetailPage';

vi.mock('../hooks/use-projects', () => ({ useProject: vi.fn() }));
vi.mock('../../work-items/use-work-items', () => ({ useWorkItems: vi.fn(), useWorkItem: vi.fn(), useWorkItemMutations: vi.fn() }));
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

function renderDetail(actorId: string, path = '/projects/p1') {
  const auth: AuthContextValue = {
    state: {
      status: 'authenticated',
      user: { id: actorId, email: 'a@b.com', displayName: 'Admin', role: 'ADMIN' },
    },
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), request: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/projects/:projectId" element={<ProjectDetailPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useWorkItems).mockReturnValue({ data: [], isPending: false, isError: false } as unknown as ReturnType<typeof useWorkItems>);
    vi.mocked(useWorkItemMutations).mockReturnValue({ create: { mutateAsync: vi.fn(), isPending: false }, update: { mutateAsync: vi.fn(), isPending: false } } as unknown as ReturnType<typeof useWorkItemMutations>);
  });

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
    expect(screen.queryByRole('button', { name: 'Thêm task' })).not.toBeInTheDocument();
  });

  it('creates a task from the fixed action on its shelf', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'item-1' });
    vi.mocked(useWorkItemMutations).mockReturnValue({ create: { mutateAsync: create, isPending: false }, update: { mutateAsync: vi.fn(), isPending: false } } as unknown as ReturnType<typeof useWorkItemMutations>);
    vi.mocked(useProjectMembers).mockReturnValue({ data: { data: [] }, isPending: false, isError: false } as unknown as ReturnType<typeof useProjectMembers>);
    vi.mocked(useProject).mockReturnValue({ data: {
      id: 'p1', key: 'AIF', name: 'AI Factory', description: null, status: 'ACTIVE',
      startDate: null, endDate: null, archivedAt: null, deletedAt: null, accessRole: 'OWNER',
      owner: { id: 'owner-1', displayName: 'Hào' }, createdAt: '2026-10-01', updatedAt: '2026-10-15',
    }, isPending: false, isError: false } as unknown as ReturnType<typeof useProject>);

    renderDetail('owner-1');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm task' }));
    await userEvent.type(screen.getByLabelText('Tên công việc'), 'Thiết kế hệ thống');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo task' }));

    expect(create).toHaveBeenCalledWith({ type: 'TASK', title: 'Thiết kế hệ thống' });
  });

  it('keeps keyboard focus in the create dialog and returns it to the add button on Escape', async () => {
    vi.mocked(useProjectMembers).mockReturnValue({ data: { data: [] }, isPending: false, isError: false } as unknown as ReturnType<typeof useProjectMembers>);
    vi.mocked(useProject).mockReturnValue({ data: {
      id: 'p1', key: 'AIF', name: 'AI Factory', description: null, status: 'ACTIVE',
      startDate: null, endDate: null, archivedAt: null, deletedAt: null, accessRole: 'OWNER',
      owner: { id: 'owner-1', displayName: 'Hào' }, createdAt: '2026-10-01', updatedAt: '2026-10-15',
    }, isPending: false, isError: false } as unknown as ReturnType<typeof useProject>);
    const user = userEvent.setup();

    renderDetail('owner-1');
    const addButton = screen.getByRole('button', { name: 'Thêm task' });
    await user.click(addButton);

    expect(screen.getByRole('dialog', { name: 'Tạo task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên công việc')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Hủy' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Tạo task' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Tạo task' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Tạo task' })).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();

    await user.click(addButton);
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog', { name: 'Tạo task' })).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();
  });

  it('opens an item from a direct URL and closes back to the project', async () => {
    vi.mocked(useWorkItem).mockReturnValue({ data: {
      id: 'item-1', projectId: 'p1', type: 'TASK', title: 'Thiết kế hệ thống',
      description: 'Nội dung công việc', status: 'TODO', priority: 'MEDIUM',
      dueDate: null, assigneeId: null, labels: [], createdAt: '2026-10-19', updatedAt: '2026-10-19',
    }, isPending: false, isError: false } as unknown as ReturnType<typeof useWorkItem>);
    vi.mocked(useProjectMembers).mockReturnValue({ data: { data: [] }, isPending: false, isError: false } as unknown as ReturnType<typeof useProjectMembers>);
    vi.mocked(useProject).mockReturnValue({ data: {
      id: 'p1', key: 'AIF', name: 'AI Factory', description: null, status: 'ACTIVE',
      startDate: null, endDate: null, archivedAt: null, deletedAt: null, accessRole: 'OWNER',
      owner: { id: 'owner-1', displayName: 'Hào' }, createdAt: '2026-10-01', updatedAt: '2026-10-15',
    }, isPending: false, isError: false } as unknown as ReturnType<typeof useProject>);

    renderDetail('owner-1', '/projects/p1?item=item-1');
    expect(screen.getByRole('dialog', { name: 'Chi tiết Thiết kế hệ thống' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
