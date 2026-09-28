import { validateEnvironment } from './environment.schema';

const validEnvironment = {
  NODE_ENV: 'development',
  API_PORT: '3000',
  SWAGGER_ENABLED: 'true',
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PORT: '5433',
  POSTGRES_DB: 'project_management',
  POSTGRES_USER: 'project_management',
  POSTGRES_PASSWORD: 'local-secret',
};

describe('validateEnvironment', () => {
  it('coerces a valid process environment into typed values', () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3000,
      SWAGGER_ENABLED: true,
      POSTGRES_HOST: '127.0.0.1',
      POSTGRES_PORT: 5433,
      POSTGRES_DB: 'project_management',
      POSTGRES_USER: 'project_management',
      POSTGRES_PASSWORD: 'local-secret',
    });
  });

  it('parses SWAGGER_ENABLED=false as boolean false', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      SWAGGER_ENABLED: 'false',
    });

    expect(result.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects an invalid API_PORT', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        API_PORT: 'abc',
      }),
    ).toThrow(/API_PORT/);
  });

  it('rejects an unsupported NODE_ENV', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'staging',
      }),
    ).toThrow(/NODE_ENV/);
  });

  it('reports a missing password without leaking another secret', () => {
    const input: Record<string, unknown> = {
      ...validEnvironment,
      UNRELATED_PASSWORD: 'must-not-appear-in-error',
    };

    delete input.POSTGRES_PASSWORD;

    expect(() => validateEnvironment(input)).toThrow(
      'Invalid environment variables: POSTGRES_PASSWORD',
    );

    try {
      validateEnvironment(input);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      expect(message).not.toContain('must-not-appear-in-error');
    }
  });
});