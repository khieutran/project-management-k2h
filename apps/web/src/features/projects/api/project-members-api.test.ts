import { describe, expect, it, vi } from 'vitest';

import { createProjectMembersApi } from './project-members-api';

describe('projectMembersApi', () => {
  it('lists members using an authenticated request', async () => {
    const response = {
      data: [
        {
          user: {
            id: 'owner-1',
            email: 'owner@example.com',
            displayName: 'Project Owner',
          },
          role: 'OWNER' as const,
          joinedAt: null,
        },
      ],
    };
    const request = vi.fn().mockResolvedValue(response);
    const api = createProjectMembersApi(request);

    await expect(api.list('project-1')).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith('/projects/project-1/members', {
      authenticated: true,
    });
  });

  it('adds a member with an exact email and role', async () => {
    const request = vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'member@example.com',
        displayName: 'Project Member',
      },
      role: 'MEMBER',
      joinedAt: '2026-10-16T00:00:00.000Z',
    });
    const api = createProjectMembersApi(request);

    await api.add('project-1', {
      email: 'member@example.com',
      role: 'MEMBER',
    });

    expect(request).toHaveBeenCalledWith('/projects/project-1/members', {
      authenticated: true,
      body: JSON.stringify({
        email: 'member@example.com',
        role: 'MEMBER',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('changes a member role', async () => {
    const request = vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'member@example.com',
        displayName: 'Project Member',
      },
      role: 'MANAGER',
      joinedAt: '2026-10-16T00:00:00.000Z',
    });
    const api = createProjectMembersApi(request);

    await api.changeRole('project-1', 'user-1', { role: 'MANAGER' });

    expect(request).toHaveBeenCalledWith(
      '/projects/project-1/members/user-1',
      {
        authenticated: true,
        body: JSON.stringify({ role: 'MANAGER' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      },
    );
  });

  it('removes a member', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const api = createProjectMembersApi(request);

    await api.remove('project-1', 'user-1');

    expect(request).toHaveBeenCalledWith(
      '/projects/project-1/members/user-1',
      { authenticated: true, method: 'DELETE' },
    );
  });

  it('lets the authenticated member leave a project', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const api = createProjectMembersApi(request);

    await api.leave('project-1');

    expect(request).toHaveBeenCalledWith(
      '/projects/project-1/members/me',
      { authenticated: true, method: 'DELETE' },
    );
  });
});
