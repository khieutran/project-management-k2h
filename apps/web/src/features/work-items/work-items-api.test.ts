import { describe, expect, it, vi } from 'vitest';

import { createWorkItemsApi } from './work-items-api';

describe('workItemsApi', () => {
  it('lists and creates items under the requested project', async () => {
    const request = vi.fn().mockResolvedValue([]);
    const api = createWorkItemsApi(request);

    await api.list('project-1');
    await api.create('project-1', { type: 'TASK', title: 'Build API' });

    expect(request).toHaveBeenCalledWith('/projects/project-1/work-items', { authenticated: true });
    expect(request).toHaveBeenCalledWith('/projects/project-1/work-items', {
      authenticated: true,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TASK', title: 'Build API' }),
    });
  });
});
