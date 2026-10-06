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

describe('Register endpoint (e2e)', () => {
  const email = 'register-e2e@example.com';
  const password = 'register-password-123';

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
  });

  afterEach(async () => {
    await removeTestUser();
  });

  afterAll(async () => {
    await removeTestUser();
    await app.close();
  });

  it('registers a user, creates a session, sets a cookie and returns safe auth data', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: '  REGISTER-E2E@EXAMPLE.COM  ',
        password,
        displayName: '  Register E2E User  ',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      user: {
        email,
        displayName: 'Register E2E User',
        role: UserRole.User,
      },
      accessTokenExpiresIn: 900,
    });

    expect(response.body.user.id).toEqual(expect.any(String));
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenDigest');

    const setCookieHeaders = response.headers['set-cookie'] as unknown as
      string[] | undefined;

    expect(setCookieHeaders).toHaveLength(1);

    const refreshCookie = setCookieHeaders?.[0] ?? '';

    expect(refreshCookie).toContain('refresh_token=');
    expect(refreshCookie).toContain('Path=/api/auth');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toBe(password);
    expect(user.role).toBe(UserRole.User);

    const sessions = await dataSource
      .getRepository(RefreshSession)
      .findBy({ userId: user.id });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions[0]).not.toHaveProperty('refreshToken');
  });

  it('rejects fields outside the RegisterDto contract', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        displayName: 'Register E2E User',
        role: UserRole.Admin,
      })
      .expect(400);

    await expect(
      dataSource.getRepository(User).findOneBy({ email }),
    ).resolves.toBeNull();
  });

  it('returns a conflict when the email already exists', async () => {
    const input = {
      email,
      password,
      displayName: 'Register E2E User',
    };

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(input)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(input)
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'AUTH_EMAIL_ALREADY_EXISTS',
      message: 'Email này đã được sử dụng',
    });

    expect(response.headers['set-cookie']).toBeUndefined();

    const userCount = await dataSource.getRepository(User).countBy({
      email,
    });

    expect(userCount).toBe(1);
  });
});
