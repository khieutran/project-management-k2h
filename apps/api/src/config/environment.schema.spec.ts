import { validateEnvironment } from './environment.schema';

const validEnvironment = {
  NODE_ENV: 'development',
  API_PORT: '3000',
  SWAGGER_ENABLED: 'true',
  JWT_ACCESS_SECRET: 'local-jwt-secret-at-least-32-characters',
  JWT_ACCESS_TTL_SECONDS: '900',
  REFRESH_TOKEN_PEPPER: 'local-refresh-pepper-at-least-32-characters',
  REFRESH_TOKEN_TTL_SECONDS: '604800',
  AUTH_COOKIE_SECURE: 'false',
  AUTH_COOKIE_SAME_SITE: 'lax',
  AUTH_REGISTER_RATE_LIMIT: '3',
  AUTH_REGISTER_RATE_TTL_SECONDS: '3600',
  AUTH_LOGIN_RATE_LIMIT: '5',
  AUTH_LOGIN_RATE_TTL_SECONDS: '60',
  AUTH_REFRESH_RATE_LIMIT: '20',
  AUTH_REFRESH_RATE_TTL_SECONDS: '60',
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
      JWT_ACCESS_SECRET: 'local-jwt-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_PEPPER: 'local-refresh-pepper-at-least-32-characters',
      REFRESH_TOKEN_TTL_SECONDS: 604800,
      AUTH_COOKIE_SECURE: false,
      AUTH_COOKIE_SAME_SITE: 'lax',
      AUTH_REGISTER_RATE_LIMIT: 3,
      AUTH_REGISTER_RATE_TTL_SECONDS: 3600,
      AUTH_LOGIN_RATE_LIMIT: 5,
      AUTH_LOGIN_RATE_TTL_SECONDS: 60,
      AUTH_REFRESH_RATE_LIMIT: 20,
      AUTH_REFRESH_RATE_TTL_SECONDS: 60,
      DEMO_SESSION_TTL_SECONDS: 86400,
      DEMO_RATE_LIMIT: 3,
      DEMO_RATE_TTL_SECONDS: 3600,
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
      const message = error instanceof Error ? error.message : String(error);

      expect(message).not.toContain('must-not-appear-in-error');
    }
  });

  it('rejects a short JWT access secret without leaking it', () => {
    const weakSecret = 'too-short-jwt-secret';

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: weakSecret,
      }),
    ).toThrow('Invalid environment variables: JWT_ACCESS_SECRET');

    try {
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: weakSecret,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      expect(message).not.toContain(weakSecret);
    }
  });

  it('rejects a short refresh-token pepper', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REFRESH_TOKEN_PEPPER: 'too-short-pepper',
      }),
    ).toThrow('Invalid environment variables: REFRESH_TOKEN_PEPPER');
  });

  //Contract: Min (60s), Max (3600s), Default (900s)
  it.each(['59', '3601', '900.5'])(
    'rejects invalid JWT access TTL %s',
    (invalidTtl) => {
      expect(() =>
        validateEnvironment({
          ...validEnvironment,
          JWT_ACCESS_TTL_SECONDS: invalidTtl,
        }),
      ).toThrow('Invalid environment variables: JWT_ACCESS_TTL_SECONDS');
    },
  );

  //Contract: Min (3600s), Max (2592000s), Default (604800s)
  it.each(['3599', '2592001', '604800.5'])(
    'rejects invalid refresh-token TTL %s',
    (invalidTtl) => {
      expect(() =>
        validateEnvironment({
          ...validEnvironment,
          REFRESH_TOKEN_TTL_SECONDS: invalidTtl,
        }),
      ).toThrow('Invalid environment variables: REFRESH_TOKEN_TTL_SECONDS');
    },
  );

  it('rejects SameSite=None without a secure cookie', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        AUTH_COOKIE_SECURE: 'false',
        AUTH_COOKIE_SAME_SITE: 'none',
      }),
    ).toThrow('Invalid environment variables: AUTH_COOKIE_SAME_SITE');
  });

  // Test này bảo đảm giới hạn request và cửa sổ thời gian phải là số nguyên dương hợp lệ.
  it.each([
    ['AUTH_REGISTER_RATE_LIMIT', '0'],
    ['AUTH_REGISTER_RATE_TTL_SECONDS', '0'],
    ['AUTH_LOGIN_RATE_LIMIT', '1.5'],
    ['AUTH_LOGIN_RATE_TTL_SECONDS', '86401'],
    ['AUTH_REFRESH_RATE_LIMIT', 'abc'],
    ['AUTH_REFRESH_RATE_TTL_SECONDS', '-1'],
  ])('rejects invalid auth rate-limit setting %s=%s', (key, value) => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        [key]: value,
      }),
    ).toThrow(`Invalid environment variables: ${key}`);
  });
});
