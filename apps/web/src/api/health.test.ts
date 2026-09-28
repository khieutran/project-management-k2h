import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { fetchHealth } from './health';

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('fetchHealth', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls the relative health endpoint and returns valid data', async () => {
    const controller = new AbortController();

    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'ok',
        database: 'up',
        environment: 'development',
      }),
    );

    await expect(
      fetchHealth(controller.signal),
    ).resolves.toEqual({
      status: 'ok',
      database: 'up',
      environment: 'development',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      {
        signal: controller.signal,
      },
    );
  });

  it('rejects a non-success HTTP response without exposing its body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          password: 'secret-password',
          connection: 'postgresql://user:password@database',
        },
        503,
      ),
    );

    let thrownError: unknown;

    try {
      await fetchHealth();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(String(thrownError)).toContain('503');
    expect(String(thrownError)).not.toContain('secret-password');
    expect(String(thrownError)).not.toContain('postgresql://');
  });

  it.each([
    [
      'a missing database field',
      {
        status: 'ok',
        environment: 'development',
      },
    ],
    [
      'an invalid database value',
      {
        status: 'ok',
        database: 'down',
        environment: 'development',
      },
    ],
    [
      'an invalid status value',
      {
        status: 'error',
        database: 'up',
        environment: 'development',
      },
    ],
  ])(
    'rejects malformed JSON containing %s',
    async (_description, body) => {
      fetchMock.mockResolvedValue(jsonResponse(body));

      await expect(fetchHealth()).rejects.toThrow(
        'Invalid health response',
      );
    },
  );

  it('forwards network errors without logging them', async () => {
    const networkError = new TypeError('Failed to fetch');

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    fetchMock.mockRejectedValue(networkError);

    await expect(fetchHealth()).rejects.toBe(
      networkError,
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});