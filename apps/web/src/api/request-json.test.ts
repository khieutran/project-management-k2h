import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ApiError } from './api-error';
import { requestJson } from './request-json';

describe('requestJson', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls a relative API URL and returns its JSON body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      requestJson<{ status: string }>('/health'),
    ).resolves.toEqual({ status: 'ok' });

    expect(fetchMock).toHaveBeenCalledWith('/api/health', {});
  });

  it('returns undefined for a successful response without a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      requestJson<void>('/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('throws a structured ApiError for a failed response', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 401,
          code: 'AUTH_ACCESS_TOKEN_INVALID',
          message: 'Access token không hợp lệ hoặc đã hết hạn',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(requestJson('/auth/me')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_ACCESS_TOKEN_INVALID',
    });
  });

  it('rejects malformed JSON from a successful response safely', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>proxy failure</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    await expect(requestJson('/auth/me')).rejects.toEqual(
      new ApiError(502, 'INVALID_API_RESPONSE', 'Phản hồi API không hợp lệ'),
    );
  });

  it('preserves a network error without logging it', async () => {
    const networkError = new TypeError('Failed to fetch');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    fetchMock.mockRejectedValue(networkError);

    await expect(requestJson('/health')).rejects.toBe(networkError);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
