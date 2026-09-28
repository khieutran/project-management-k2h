export type HealthResponse = {
  status: 'ok';
  database: 'up';
  environment: string;
};

function isHealthResponse(
  value: unknown,
): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.status === 'ok' &&
    candidate.database === 'up' &&
    typeof candidate.environment === 'string' &&
    candidate.environment.length > 0
  );
}

export async function fetchHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Health request failed with status ${response.status}`,
    );
  }

  const body: unknown = await response.json();

  if (!isHealthResponse(body)) {
    throw new Error('Invalid health response');
  }

  return body;
}