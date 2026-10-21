import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import type { Project } from '../project.types';
import { ProjectContainer } from './ProjectContainer';

const project: Project = {
  id: 'p1', key: 'AIF', name: 'AI Factory', description: null,
  status: 'ACTIVE', startDate: null, endDate: null,
  archivedAt: null, deletedAt: null, accessRole: 'OWNER',
  owner: { id: 'owner', displayName: 'Owner' },
  createdAt: '2026-10-19', updatedAt: '2026-10-19',
};

describe('ProjectContainer', () => {
  it('shows three work shelves without presenting nonfunctional create actions', () => {
    render(<ProjectContainer project={project} />);

    expect(screen.getByRole('region', { name: 'Container AI Factory' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bugs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tests' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm task/i })).not.toBeInTheDocument();
  });

  it('groups parcels by type and keeps the add control outside the scrolling shelf', () => {
    const onAdd = vi.fn();
    const items = [
      { id: 'task-1', type: 'TASK', title: 'Thiết kế hệ thống', status: 'IN_PROGRESS' },
      { id: 'bug-1', type: 'BUG', title: 'Sửa đăng nhập', status: 'TODO' },
    ] as never;
    render(<MemoryRouter><ProjectContainer project={project} items={items} canWrite onAdd={onAdd} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /Thiết kế hệ thống/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sửa đăng nhập/ })).toBeInTheDocument();
    const taskShelf = screen.getByRole('region', { name: 'Tasks' });
    const scrollingList = taskShelf.querySelector('.project-cargo-scroll');
    expect(scrollingList).toContainElement(screen.getByRole('link', { name: /Thiết kế hệ thống/ }));
    expect(scrollingList).not.toContainElement(screen.getByRole('button', { name: 'Thêm task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm task' }));
    expect(onAdd).toHaveBeenCalledWith('TASK');
  });
});
