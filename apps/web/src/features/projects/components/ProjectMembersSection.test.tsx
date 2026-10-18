import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../api/api-error';
import { useProjectMemberMutations } from '../hooks/use-project-member-mutations';
import { useProjectMembers } from '../hooks/use-project-members';
import type { Project } from '../project.types';
import { ProjectMembersSection } from './ProjectMembersSection';

vi.mock('../hooks/use-project-members', () => ({
  useProjectMembers: vi.fn(),
}));
vi.mock('../hooks/use-project-member-mutations', () => ({
  useProjectMemberMutations: vi.fn(),
}));

const project: Project = {
  id: 'project-1',
  key: 'K2H',
  name: 'Project Management K2H',
  description: null,
  status: 'ACTIVE',
  startDate: null,
  endDate: null,
  archivedAt: null,
  deletedAt: null,
  accessRole: 'OWNER',
  owner: { id: 'owner-1', displayName: 'Văn Khiếu Trần' },
  createdAt: '2026-10-16T00:00:00.000Z',
  updatedAt: '2026-10-16T00:00:00.000Z',
};

function createMutationResult() {
  return {
    addMember: { mutateAsync: vi.fn(), isPending: false },
    changeMemberRole: { mutateAsync: vi.fn(), isPending: false },
    removeMember: { mutateAsync: vi.fn(), isPending: false },
    leaveProject: { mutateAsync: vi.fn(), isPending: false },
  };
}

function renderSection(currentProject: Project = project) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${currentProject.id}`]}>
      <Routes>
        <Route
          path="/projects/:projectId"
          element={<ProjectMembersSection project={currentProject} />}
        />
        <Route path="/projects" element={<h1>Danh sách dự án</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectMembersSection', () => {
  beforeEach(() => {
    vi.mocked(useProjectMemberMutations).mockReturnValue(
      createMutationResult() as unknown as ReturnType<
        typeof useProjectMemberMutations
      >,
    );
  });

  it('shows members before the add-member form and opens the form on request', async () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [{
        user: { id: 'owner-1', displayName: 'Khách trải nghiệm', email: 'demo-example@demo.k2h.invalid' },
        role: 'OWNER', joinedAt: null,
      }] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();

    expect(screen.getByText('Khách trải nghiệm')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email thành viên')).not.toBeInTheDocument();
    expect(screen.getByText('Tài khoản trải nghiệm')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm thành viên' }));
    expect(screen.getByLabelText('Email thành viên')).toBeInTheDocument();
  });

  it('shows a loading state while members are being fetched', () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang tải thành viên...',
    );
  });

  it('shows an error and retries the member request', async () => {
    const refetch = vi.fn();
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Không thể tải danh sách thành viên.',
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the owner first and displays every member identity and role', () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [
          {
            user: {
              id: 'owner-1',
              email: 'owner@example.com',
              displayName: 'Văn Khiếu Trần',
            },
            role: 'OWNER',
            joinedAt: null,
          },
          {
            user: {
              id: 'manager-1',
              email: 'manager@example.com',
              displayName: 'Hoàng Hào',
            },
            role: 'MANAGER',
            joinedAt: '2026-10-16T01:00:00.000Z',
          },
          {
            user: {
              id: 'member-1',
              email: 'member@example.com',
              displayName: 'Quốc Hiệp',
            },
            role: 'MEMBER',
            joinedAt: '2026-10-16T02:00:00.000Z',
          },
        ],
      },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();

    const rows = within(screen.getByRole('list', { name: 'Thành viên dự án' }))
      .getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Văn Khiếu Trần');
    expect(rows[0]).toHaveTextContent('owner@example.com');
    expect(rows[0]).toHaveTextContent('Chủ sở hữu');
    expect(rows[1]).toHaveTextContent('Hoàng Hào');
    expect(rows[1]).toHaveTextContent('Quản lý');
    expect(rows[2]).toHaveTextContent('Quốc Hiệp');
    expect(rows[2]).toHaveTextContent('Thành viên');
  });

  it('shows a clear empty state', () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();

    expect(screen.getByText('Dự án chưa có thành viên.')).toBeInTheDocument();
  });

  it.each([
    ['ADMIN viewer', { accessRole: 'ADMIN_VIEWER' as const }],
    ['archived project', { archivedAt: '2026-10-16T03:00:00.000Z' }],
    ['deleted project', { deletedAt: '2026-10-16T03:00:00.000Z' }],
  ])('marks the member list read-only for an %s', (_caseName, overrides) => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection({ ...project, ...overrides });

    expect(
      screen.getByText('Danh sách thành viên đang ở chế độ chỉ xem.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Thêm thành viên' }),
    ).not.toBeInTheDocument();
  });

  it('lets the owner change a member role', async () => {
    const mutations = createMutationResult();
    mutations.changeMemberRole.mutateAsync.mockResolvedValue(undefined);
    vi.mocked(useProjectMemberMutations).mockReturnValue(
      mutations as unknown as ReturnType<typeof useProjectMemberMutations>,
    );
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [
          {
            user: {
              id: 'owner-1',
              email: 'owner@example.com',
              displayName: 'Văn Khiếu Trần',
            },
            role: 'OWNER',
            joinedAt: null,
          },
          {
            user: {
              id: 'member-1',
              email: 'member@example.com',
              displayName: 'Hoàng Hào',
            },
            role: 'MEMBER',
            joinedAt: '2026-10-16T01:00:00.000Z',
          },
        ],
      },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Vai trò của Hoàng Hào' }),
      'MANAGER',
    );

    expect(mutations.changeMemberRole.mutateAsync).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'member-1',
      input: { role: 'MANAGER' },
    });
  });

  it('removes a member only after normal confirmation', async () => {
    const mutations = createMutationResult();
    mutations.removeMember.mutateAsync.mockResolvedValue(undefined);
    vi.mocked(useProjectMemberMutations).mockReturnValue(
      mutations as unknown as ReturnType<typeof useProjectMemberMutations>,
    );
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [
          {
            user: {
              id: 'member-1',
              email: 'member@example.com',
              displayName: 'Hoàng Hào',
            },
            role: 'MEMBER',
            joinedAt: '2026-10-16T01:00:00.000Z',
          },
        ],
      },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection();
    await userEvent.click(
      screen.getByRole('button', { name: 'Xóa Hoàng Hào' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Xóa Hoàng Hào khỏi dự án?',
    );
    expect(mutations.removeMember.mutateAsync).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Xóa thành viên' }),
    );

    expect(mutations.removeMember.mutateAsync).toHaveBeenCalledWith({
      projectId: 'project-1',
      userId: 'member-1',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['MANAGER', 'MEMBER'] as const)(
    'shows the leave action to a current %s',
    (accessRole) => {
      vi.mocked(useProjectMembers).mockReturnValue({
        isPending: false,
        isError: false,
        data: { data: [] },
      } as unknown as ReturnType<typeof useProjectMembers>);

      renderSection({ ...project, accessRole });

      expect(
        screen.getByRole('button', { name: 'Rời dự án' }),
      ).toBeInTheDocument();
    },
  );

  it.each(['OWNER', 'ADMIN_VIEWER'] as const)(
    'does not show the leave action to an %s',
    (accessRole) => {
      vi.mocked(useProjectMembers).mockReturnValue({
        isPending: false,
        isError: false,
        data: { data: [] },
      } as unknown as ReturnType<typeof useProjectMembers>);

      renderSection({ ...project, accessRole });

      expect(
        screen.queryByRole('button', { name: 'Rời dự án' }),
      ).not.toBeInTheDocument();
    },
  );

  it('asks for normal confirmation without requiring a project key', async () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection({ ...project, accessRole: 'MEMBER' });
    await userEvent.click(screen.getByRole('button', { name: 'Rời dự án' }));

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Rời dự án Project Management K2H?',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xác nhận rời dự án' }),
    ).toBeInTheDocument();
  });

  it('keeps the member on the detail page when leaving fails', async () => {
    const mutations = createMutationResult();
    mutations.leaveProject.mutateAsync.mockRejectedValue(
      new ApiError(
        409,
        'PROJECT_MEMBERSHIP_LOCKED',
        'Thành viên của dự án đang bị khóa',
      ),
    );
    vi.mocked(useProjectMemberMutations).mockReturnValue(
      mutations as unknown as ReturnType<typeof useProjectMemberMutations>,
    );
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection({ ...project, accessRole: 'MEMBER' });
    await userEvent.click(screen.getByRole('button', { name: 'Rời dự án' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Xác nhận rời dự án' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Thành viên của dự án đang bị khóa',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Danh sách dự án' }),
    ).not.toBeInTheDocument();
  });

  it('redirects only after leaving succeeds', async () => {
    const mutations = createMutationResult();
    mutations.leaveProject.mutateAsync.mockResolvedValue(undefined);
    vi.mocked(useProjectMemberMutations).mockReturnValue(
      mutations as unknown as ReturnType<typeof useProjectMemberMutations>,
    );
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    renderSection({ ...project, accessRole: 'MANAGER' });
    await userEvent.click(screen.getByRole('button', { name: 'Rời dự án' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Xác nhận rời dự án' }),
    );

    expect(mutations.leaveProject.mutateAsync).toHaveBeenCalledWith(
      'project-1',
    );
    expect(
      await screen.findByRole('heading', { name: 'Danh sách dự án' }),
    ).toBeInTheDocument();
  });
});
