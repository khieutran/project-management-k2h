type ApiErrorBody = {
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: string[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function createApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;

  try {
    const candidate: unknown = await response.json();

    if (isRecord(candidate)) {
      body = candidate;
    }
  } catch {
    body = undefined;
  }

  if (
    body?.statusCode === response.status &&
    typeof body.code === 'string' &&
    typeof body.message === 'string'
  ) {
    const details = Array.isArray(body.details)
      ? body.details.filter(
          (detail): detail is string => typeof detail === 'string',
        )
      : undefined;

    return new ApiError(
      response.status,
      body.code,
      body.message,
      details,
    );
  }

  return new ApiError(
    response.status,
    `HTTP_${response.status}`,
    'Yêu cầu không thể được xử lý',
  );
}
