import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Project } from '../project.types';
import { ProjectYard } from './ProjectYard';

function project(index: number): Project {
  return {
    id: `project-${index}`, key: `P${index}`, name: `Dự án ${index}`,
    description: null, status: 'ACTIVE', startDate: null, endDate: null,
    archivedAt: null, deletedAt: null, accessRole: 'OWNER',
    owner: { id: 'owner', displayName: 'Chủ dự án' },
    createdAt: '2026-10-19', updatedAt: '2026-10-19',
  };
}

describe('ProjectYard', () => {
  it('places seven projects in exactly seven straight parking slots', () => {
    render(<MemoryRouter><ProjectYard projects={Array.from({ length: 7 }, (_, index) => project(index + 1))} page={1} showOwner={false} /></MemoryRouter>);

    expect(screen.getAllByTestId('yard-slot')).toHaveLength(7);
    expect(within(document.querySelector('.yard-lot') as HTMLElement).getByRole('link', { name: /Dự án 7/ })).toHaveAttribute('href', '/projects/project-7');
    expect(screen.queryByRole('link', { name: /Tạo dự án/ })).not.toBeInTheDocument();
  });

  it('uses an available straight slot for creating a project on the next yard', () => {
    render(<MemoryRouter><ProjectYard projects={[project(8)]} page={2} showOwner={false} /></MemoryRouter>);

    expect(screen.getByText('Bãi 2')).toBeInTheDocument();
    expect(within(document.querySelector('.yard-lot') as HTMLElement).getByRole('link', { name: /Tạo dự án/ })).toHaveAttribute('href', '/projects/new');
    expect(screen.getAllByTestId('yard-slot')).toHaveLength(7);
  });
});
