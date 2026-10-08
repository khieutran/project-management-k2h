import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { RefreshSession } from '../src/refresh-sessions/entities/refresh-session.entity';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

describe('Login endpoint (e2e)', () => {
  const email = 'login-e2e@example.com';
  const password = 'login-password-123';

  let app: INestApplication;
  let dataSource: DataSource;

  async function removeTestUser(): Promise<void> {
    await dataSource.getRepository(User).delete({ email });
  }

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    app.useGlobalPipes(createApplicationValidationPipe());

    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    const swaggerEnabled = configService.getOrThrow<boolean>('SWAGGER_ENABLED');

    app.setGlobalPrefix('api');
    setupSwagger(app, swaggerEnabled);

    await app.init();

    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await removeTestUser();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        displayName: 'Login E2E User',
      })
      .expect(201);
  });

  afterEach(async () => {
    await removeTestUser();
  });

  afterAll(async () => {
    await removeTestUser();
    await app.close();
  });

  it('logs in an existing user and creates a new session family', async () => {
    // Arrange
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });

    const sessionsBeforeLogin = await dataSource
      .getRepository(RefreshSession)
      .findBy({ userId: user.id });

    expect(sessionsBeforeLogin).toHaveLength(1);

    // Act
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    // Assert: HTTP response
    expect(response.body).toMatchObject({
      user: {
        id: user.id,
        email,
        displayName: 'Login E2E User',
        role: UserRole.User,
      },
      accessTokenExpiresIn: 900,
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenDigest');

    // Assert: refresh token is delivered only through an HttpOnly cookie
    const setCookieHeaders = response.headers['set-cookie'] as unknown as
      string[] | undefined;

    expect(setCookieHeaders).toHaveLength(1);

    const refreshCookie = setCookieHeaders?.[0] ?? '';

    expect(refreshCookie).toContain('refresh_token=');
    expect(refreshCookie).toContain('Path=/api/auth');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');

    // Assert: Login creates a separate refresh-session family
    const sessionsAfterLogin = await dataSource
      .getRepository(RefreshSession)
      .findBy({ userId: user.id });

    expect(sessionsAfterLogin).toHaveLength(2);
    expect(
      new Set(sessionsAfterLogin.map((session) => session.familyId)).size,
    ).toBe(2);
    expect(
      sessionsAfterLogin.every((session) =>
        /^[a-f0-9]{64}$/.test(session.tokenDigest),
      ),
    ).toBe(true);
  });

  it('normalizes email before authentication', async () => {
    const unnormalizedEmail = '  LOGIN-E2E@EXAMPLE.COM  ';

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: unnormalizedEmail,
        password,
      })
      .expect(200);

    //Pass de chung minh he thong nhan vao: "login-e2e@example.com"
    expect(response.body.user.email).toBe(email);
  });

  //Gop 2 test giong nhau thanh 1 test duy nhat nhung chay 2 lan bang 2 case options khac nhau
  it.each([
    {
      description: 'incorrect password',
      loginEmail: email,
      loginPassword: 'wrong-password-123',
    },
    {
      description: 'unknown email',
      loginEmail: 'missing-login-e2e@example.com',
      loginPassword: password,
    },
  ])(
    'returns generic invalid credentials for $description',
    async ({ loginEmail, loginPassword }) => {
      const user = await dataSource
        .getRepository(User)
        .findOneByOrFail({ email });

      const sessionCountBefore = await dataSource
        .getRepository(RefreshSession)
        .countBy({ userId: user.id });

      expect(sessionCountBefore).toBe(1);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: loginEmail,
          password: loginPassword,
        })
        .expect(401);

      expect(response.body).toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không hợp lệ',
      });

      expect(response.headers['set-cookie']).toBeUndefined();

      const sessionCountAfter = await dataSource
        .getRepository(RefreshSession)
        .countBy({ userId: user.id });

      expect(sessionCountAfter).toBe(sessionCountBefore);
    },
  );

  it('rejects fields outside the LoginDto contract', async () => {
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });

    const sessionCountBefore = await dataSource
      .getRepository(RefreshSession)
      .countBy({ userId: user.id });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password,
        role: UserRole.Admin,
      })
      .expect(400);

    expect(response.headers['set-cookie']).toBeUndefined();

    const sessionCountAfter = await dataSource
      .getRepository(RefreshSession)
      .countBy({ userId: user.id });

    expect(sessionCountAfter).toBe(sessionCountBefore);
  });

  it('preserves leading and trailing password whitespace', async () => {
    const passwordWithWhitespace = '  login-password-123  ';

    await removeTestUser();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: passwordWithWhitespace,
        displayName: 'Login E2E User',
      })
      .expect(201);

    const successResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: passwordWithWhitespace,
      })
      .expect(200);

    expect(successResponse.body.user.email).toBe(email);
    expect(successResponse.body.user).not.toHaveProperty('password');
    expect(successResponse.body.user).not.toHaveProperty('passwordHash');

    const failureResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: passwordWithWhitespace.trim(),
      })
      .expect(401);

    expect(failureResponse.body).toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không hợp lệ',
    });

    expect(failureResponse.headers['set-cookie']).toBeUndefined();
  });
});
