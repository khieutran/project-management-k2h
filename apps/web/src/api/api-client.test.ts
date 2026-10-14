import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAccessTokenStore } from '../auth/access-token-store';
import type { AuthResponse } from '../auth/auth.types';
import { ApiError } from './api-error';
import { createApiClient } from './api-client';

const refreshedAuth: AuthResponse = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    displayName: 'Nguyen Van A',
    role: 'USER',
  },
  accessToken: 'fresh-access-token',
  accessTokenExpiresIn: 900,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the current access token to a protected request', async () => {
    const tokenStore = createAccessTokenStore();
    tokenStore.set('current-access-token');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ projects: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      tokenStore,
      refresh: vi.fn(),
      onSessionRefreshed: vi.fn(),
      onAuthenticationFailure: vi.fn(),
    });

    await client.request('/projects', { authenticated: true });

    const options = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer current-access-token',
    );
  });

  it('refreshes and retries once with the replacement token after 401', async () => {
    const tokenStore = createAccessTokenStore();
    tokenStore.set('expired-access-token');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 401,
            code: 'AUTH_ACCESS_TOKEN_INVALID',
            message: 'Access token không hợp lệ hoặc đã hết hạn',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ projects: ['one'] }));
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn().mockResolvedValue(refreshedAuth);

    const client = createApiClient({
      tokenStore,
      refresh,
      onSessionRefreshed: vi.fn(),
      onAuthenticationFailure: vi.fn(),
    });

    await expect(
      client.request<{ projects: string[] }>('/projects', {
        authenticated: true,
      }),
    ).resolves.toEqual({ projects: ['one'] });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBe('fresh-access-token');
    const retryOptions = fetchMock.mock.calls[1]?.[1];
    expect(new Headers(retryOptions?.headers).get('Authorization')).toBe(
      'Bearer fresh-access-token',
    );
  });

  it('shares one refresh operation across concurrent 401 responses', async () => {
    const tokenStore = createAccessTokenStore();
    tokenStore.set('expired-access-token');
    const unauthorized = () =>
      jsonResponse(
        { statusCode: 401, code: 'EXPIRED', message: 'Expired' },
        401,
      );
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ id: 1 }))
      .mockResolvedValueOnce(jsonResponse({ id: 2 }));
    vi.stubGlobal('fetch', fetchMock);
    let resolveRefresh!: (value: AuthResponse) => void;
    const refresh = vi.fn(
      () =>
        new Promise<AuthResponse>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const client = createApiClient({
      tokenStore,
      refresh,
      onSessionRefreshed: vi.fn(),
      onAuthenticationFailure: vi.fn(),
    });

    const requests = Promise.all([
      client.request('/projects/1', { authenticated: true }),
      client.request('/projects/2', { authenticated: true }),
    ]);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRefresh(refreshedAuth);

    await expect(requests).resolves.toEqual([{ id: 1 }, { id: 2 }]);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('clears authentication when refresh fails and does not retry', async () => {
    const tokenStore = createAccessTokenStore();
    tokenStore.set('expired-access-token');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { statusCode: 401, code: 'EXPIRED', message: 'Expired' },
        401,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const refreshError = new ApiError(
      401,
      'AUTH_REFRESH_TOKEN_INVALID',
      'Refresh token không hợp lệ',
    );
    const onAuthenticationFailure = vi.fn();

    const client = createApiClient({
      tokenStore,
      refresh: vi.fn().mockRejectedValue(refreshError),
      onSessionRefreshed: vi.fn(),
      onAuthenticationFailure,
    });

    await expect(
      client.request('/projects', { authenticated: true }),
    ).rejects.toBe(refreshError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeNull();
    expect(onAuthenticationFailure).toHaveBeenCalledTimes(1);
  });
});
