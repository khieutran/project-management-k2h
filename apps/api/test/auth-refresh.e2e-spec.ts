import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { RefreshSession } from '../src/refresh-sessions/entities/refresh-session.entity';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

describe('Refresh endpoint (e2e)', () => {
  const email = 'refresh-e2e@example.com';
  const password = 'refresh-password-123';

  let app: INestApplication;
  let dataSource: DataSource;

  async function removeTestUser(): Promise<void> {
    await dataSource.getRepository(User).delete({ email });
  }

  async function registerAndGetCookie(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        displayName: 'Refresh E2E User',
      })
      .expect(201);

    const setCookieHeaders = response.headers['set-cookie'] as unknown as
      string[] | undefined;

    expect(setCookieHeaders).toHaveLength(1);

    return setCookieHeaders?.[0]?.split(';')[0] ?? '';
  }

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    app.use(cookieParser());
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

  it('rotates a valid refresh token and persists the replacement session', async () => {
    const originalCookie = await registerAndGetCookie();
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });
    const originalSession = await dataSource
      .getRepository(RefreshSession)
      .findOneByOrFail({ userId: user.id });

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: user.id,
        email,
        displayName: 'Refresh E2E User',
        role: UserRole.User,
      },
      accessTokenExpiresIn: 900,
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.body).not.toHaveProperty('tokenDigest');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const replacementCookieHeaders = response.headers[
      'set-cookie'
    ] as unknown as string[] | undefined;

    expect(replacementCookieHeaders).toHaveLength(1);

    const replacementCookie =
      replacementCookieHeaders?.[0]?.split(';')[0] ?? '';

    expect(replacementCookie).toContain('refresh_token=');
    expect(replacementCookie).not.toBe(originalCookie);

    const sessions = await dataSource
      .getRepository(RefreshSession)
      .findBy({ userId: user.id });

    expect(sessions).toHaveLength(2);

    const persistedOriginal = sessions.find(
      (session) => session.id === originalSession.id,
    );
    const persistedReplacement = sessions.find(
      (session) => session.id !== originalSession.id,
    );

    expect(persistedOriginal?.familyId).toBe(originalSession.familyId);
    expect(persistedOriginal?.revokedAt).toBeInstanceOf(Date);
    expect(persistedOriginal?.replacedBySessionId).toBe(
      persistedReplacement?.id,
    );
    expect(persistedReplacement?.familyId).toBe(originalSession.familyId);
    expect(persistedReplacement?.revokedAt).toBeNull();
    expect(persistedReplacement?.replacedBySessionId).toBeNull();
  });

  it('revokes the entire session family when a rotated token is reused', async () => {
    const originalCookie = await registerAndGetCookie();
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });
    const originalSession = await dataSource
      .getRepository(RefreshSession)
      .findOneByOrFail({ userId: user.id });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200);

    const reuseResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401);

    expect(reuseResponse.body).toMatchObject({
      code: 'AUTH_REFRESH_TOKEN_REUSED',
      message: 'Phát hiện refresh token đã được sử dụng lại',
    });

    const clearCookieHeaders = reuseResponse.headers[
      'set-cookie'
    ] as unknown as string[] | undefined;

    expect(clearCookieHeaders).toHaveLength(1);

    const clearedCookie = clearCookieHeaders?.[0] ?? '';

    expect(clearedCookie).toContain('refresh_token=');
    expect(clearedCookie).toMatch(
      /(?:Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT)/,
    );

    const familySessions = await dataSource
      .getRepository(RefreshSession)
      .findBy({ familyId: originalSession.familyId });

    expect(familySessions).toHaveLength(2);
    expect(familySessions.every((session) => session.revokedAt !== null)).toBe(
      true,
    );
  });

  it('rejects a missing refresh cookie without creating a session', async () => {
    await registerAndGetCookie();

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });
    const sessionCountBefore = await dataSource
      .getRepository(RefreshSession)
      .countBy({ userId: user.id });

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTH_REFRESH_TOKEN_MISSING',
      message: 'Không tìm thấy refresh token',
    });

    const sessionCountAfter = await dataSource
      .getRepository(RefreshSession)
      .countBy({ userId: user.id });

    expect(sessionCountAfter).toBe(sessionCountBefore);
  });
});
