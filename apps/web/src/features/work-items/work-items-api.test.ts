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

  it('keeps the explicit deleted-view option on parcel read requests', async () => {
    const request = vi.fn().mockResolvedValue([]);
    const api = createWorkItemsApi(request);

    await Reflect.apply(api.list, api, ['project-1', true]);
    await Reflect.apply(api.detail, api, ['project-1', 'item-1', true]);

    expect(request).toHaveBeenCalledWith('/projects/project-1/work-items?includeDeleted=true', { authenticated: true });
    expect(request).toHaveBeenCalledWith('/projects/project-1/work-items/item-1?includeDeleted=true', { authenticated: true });
  });
});
