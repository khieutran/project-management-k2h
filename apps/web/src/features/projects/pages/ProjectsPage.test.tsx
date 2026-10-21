import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../auth/auth-context';
import { useProjects } from '../hooks/use-projects';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../hooks/use-projects', () => ({ useProjects: vi.fn() }));

const auth: AuthContextValue = {
  state: {
    status: 'authenticated',
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'ADMIN',
    },
  },
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  request: vi.fn(),
};

describe('ProjectsPage', () => {
  it('shows owner labels and the ADMIN-only deleted view', () => {
    vi.mocked(useProjects).mockReturnValue({
      data: {
        data: [
          {
            id: 'p1', key: 'K2H', name: 'K2H', description: null,
            status: 'ACTIVE', startDate: null, endDate: null,
            archivedAt: null, deletedAt: null,
            accessRole: 'ADMIN_VIEWER',
            owner: { id: 'user-2', displayName: 'Hoàng Hào' },
            createdAt: '2026-10-15', updatedAt: '2026-10-15',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProjects>);

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter><ProjectsPage /></MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText('Hoàng Hào')).toBeInTheDocument();
    expect(screen.getByText('Quản trị · Chỉ xem')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đã xóa' })).toBeInTheDocument();
  });

  it('returns to the last available yard when a filter removes later pages', async () => {
    vi.mocked(useProjects).mockImplementation((query) => ({
      data: {
        data: [],
        pagination: { page: query.page, limit: 7, total: 7, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProjects>));

    function Location() {
      const location = useLocation();
      return <output data-testid="location">{location.search}</output>;
    }

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/projects?view=current&page=3&status=ACTIVE']}>
          <ProjectsPage /><Location />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('page=1'));
    expect(screen.getByTestId('location')).toHaveTextContent('status=ACTIVE');
  });
});
