import { describe, expect, it } from 'vitest';

import { ApiError, createApiError } from './api-error';

describe('createApiError', () => {
  it('keeps the safe error contract returned by the API', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không hợp lệ',
        path: '/api/auth/login',
        timestamp: '2026-10-14T00:00:00.000Z',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    await expect(createApiError(response)).resolves.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không hợp lệ',
    });
  });

  it('sanitizes an untrusted non-JSON error body', async () => {
    const response = new Response('database password=secret', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });

    const error = await createApiError(response);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 500,
      code: 'HTTP_500',
      message: 'Yêu cầu không thể được xử lý',
    });
    expect(String(error)).not.toContain('secret');
  });
});
