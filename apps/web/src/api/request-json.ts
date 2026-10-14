import { ApiError, createApiError } from './api-error';

function createApiPath(path: string): string {
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(createApiPath(path), options);

  if (!response.ok) {
    throw await createApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();

  if (body.length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError(
      502,
      'INVALID_API_RESPONSE',
      'Phản hồi API không hợp lệ',
    );
  }
}
