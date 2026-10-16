import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useProjectMembers } from '../hooks/use-project-members';
import type { Project } from '../project.types';
import { ProjectMembersSection } from './ProjectMembersSection';

vi.mock('../hooks/use-project-members', () => ({
  useProjectMembers: vi.fn(),
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

describe('ProjectMembersSection', () => {
  it('shows a loading state while members are being fetched', () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useProjectMembers>);

    render(<ProjectMembersSection project={project} />);

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

    render(<ProjectMembersSection project={project} />);
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

    render(<ProjectMembersSection project={project} />);

    const rows = within(screen.getByRole('list', { name: 'Thành viên dự án' }))
      .getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Văn Khiếu Trần');
    expect(rows[0]).toHaveTextContent('owner@example.com');
    expect(rows[0]).toHaveTextContent('Chủ sở hữu');
    expect(rows[1]).toHaveTextContent('Hoàng Hào');
    expect(rows[1]).toHaveTextContent('Manager');
    expect(rows[2]).toHaveTextContent('Quốc Hiệp');
    expect(rows[2]).toHaveTextContent('Member');
  });

  it('shows a clear empty state', () => {
    vi.mocked(useProjectMembers).mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [] },
    } as unknown as ReturnType<typeof useProjectMembers>);

    render(<ProjectMembersSection project={project} />);

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

    render(
      <ProjectMembersSection project={{ ...project, ...overrides }} />,
    );

    expect(
      screen.getByText('Danh sách thành viên đang ở chế độ chỉ xem.'),
    ).toBeInTheDocument();
  });
});
