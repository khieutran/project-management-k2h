import { describe, expect, it, vi } from 'vitest';

import { createProjectsApi } from './projects-api';

describe('projectsApi', () => {
  it('maps list filters to an authenticated query request', async () => {
    const request = vi.fn().mockResolvedValue({ data: [], pagination: {} });
    const api = createProjectsApi(request);

    await api.list({
      page: 2,
      limit: 20,
      search: 'K2H platform',
      status: 'ACTIVE',
      view: 'archived',
    });

    expect(request).toHaveBeenCalledWith(
      '/projects?page=2&limit=20&search=K2H+platform&status=ACTIVE&view=archived',
      { authenticated: true },
    );
  });

  it('sends nullable fields when updating a project', async () => {
    const request = vi.fn().mockResolvedValue({ id: 'project-1' });
    const api = createProjectsApi(request);

    await api.update('project-1', {
      name: 'K2H',
      description: null,
      startDate: null,
      endDate: null,
    });

    expect(request).toHaveBeenCalledWith('/projects/project-1', {
      authenticated: true,
      body: JSON.stringify({
        name: 'K2H',
        description: null,
        startDate: null,
        endDate: null,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    });
  });
});
