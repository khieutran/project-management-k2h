import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { useProjects } from '../features/projects/hooks/use-projects';
import type { PaginatedProjects, Project } from '../features/projects/project.types';
import { HomePage } from './HomePage';

vi.mock('../features/projects/hooks/use-projects', () => ({ useProjects: vi.fn() }));

const project: Project = {
  id: 'project-1', key: 'K2H', name: 'Website sản phẩm',
  description: 'Chuẩn bị phát hành website.', status: 'ACTIVE',
  startDate: null, endDate: null, archivedAt: null, deletedAt: null,
  accessRole: 'OWNER', owner: { id: 'user-1', displayName: 'An' },
  createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-17T00:00:00.000Z',
};

const auth: AuthContextValue = {
  state: {
    status: 'authenticated',
    user: { id: 'user-1', email: 'demo@demo.k2h.invalid', displayName: 'An', role: 'USER' },
  },
  login: vi.fn(), register: vi.fn(), logout: vi.fn(), request: vi.fn(),
};

function queryResult(data: Project[], total: number) {
  return {
    data: { data, pagination: { page: 1, limit: 5, total, totalPages: 1 } } satisfies PaginatedProjects,
    isPending: false, isError: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useProjects>;
}

function renderHome() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('HomePage', () => {
  it('shows a project overview from real query totals and recent projects', () => {
    vi.mocked(useProjects).mockImplementation((query) => {
      if (query.status === 'ACTIVE') return queryResult([], 2);
      if (query.status === 'PLANNING') return queryResult([], 1);
      if (query.status === 'COMPLETED') return queryResult([], 3);
      return queryResult([project], 6);
    });

    renderHome();

    expect(screen.getByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Tình trạng dự án' });
    expect(within(summary).getByText('2')).toBeInTheDocument();
    expect(within(summary).getByText('1')).toBeInTheDocument();
    expect(within(summary).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Website sản phẩm/ })).toHaveAttribute('href', '/projects/project-1');
    expect(screen.getByRole('link', { name: 'Tạo dự án' })).toHaveAttribute('href', '/projects/new');
    expect(screen.queryByText('Authentication ready')).not.toBeInTheDocument();
    expect(screen.queryByText('demo@demo.k2h.invalid')).not.toBeInTheDocument();
  });

  it('offers a retry when recent projects cannot load', () => {
    const refetch = vi.fn();
    vi.mocked(useProjects).mockImplementation((query) => query.status
      ? queryResult([], 0)
      : { isPending: false, isError: true, refetch } as unknown as ReturnType<typeof useProjects>);

    renderHome();

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải dự án gần đây.');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
