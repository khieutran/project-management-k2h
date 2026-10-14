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

// Nhóm E2E này kiểm tra toàn bộ luồng HTTP -> controller -> service -> PostgreSQL của endpoint logout.
describe('Logout endpoint (e2e)', () => {
  const email = 'logout-e2e@example.com';
  const password = 'logout-password-123';

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
        displayName: 'Logout E2E User',
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

  // Test này bắt lỗi endpoint trả sai status, quên xóa cookie hoặc không thu hồi session trong database.
  it('revokes the current session, clears the cookie and returns no content', async () => {
    const refreshCookie = await registerAndGetCookie();
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });
    const sessionBeforeLogout = await dataSource
      .getRepository(RefreshSession)
      .findOneByOrFail({ userId: user.id });

    expect(sessionBeforeLogout.revokedAt).toBeNull();

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(204);

    expect(response.text).toBe('');

    const clearCookieHeaders = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    const clearedCookie = clearCookieHeaders?.[0] ?? '';

    expect(clearCookieHeaders).toHaveLength(1);
    expect(clearedCookie).toContain('refresh_token=');
    expect(clearedCookie).toContain('Path=/api/auth');
    expect(clearedCookie).toMatch(
      /(?:Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT)/,
    );

    const sessionAfterLogout = await dataSource
      .getRepository(RefreshSession)
      .findOneByOrFail({ id: sessionBeforeLogout.id });

    expect(sessionAfterLogout.revokedAt).toBeInstanceOf(Date);
    expect(sessionAfterLogout.replacedBySessionId).toBeNull();
  });

  // Test này bảo vệ tính idempotent: cùng một token logout lần hai vẫn trả 204 và không tạo thêm dữ liệu.
  it('succeeds when the same refresh token is logged out twice', async () => {
    const refreshCookie = await registerAndGetCookie();
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(204);

    const sessions = await dataSource
      .getRepository(RefreshSession)
      .findBy({ userId: user.id });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.revokedAt).toBeInstanceOf(Date);
  });

  // Test này bảo đảm request thiếu cookie vẫn trả 204, xóa cookie phía client và không thay đổi session trong database.
  it('succeeds without a refresh cookie and leaves sessions unchanged', async () => {
    await registerAndGetCookie();

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });
    const sessionCountBefore = await dataSource
      .getRepository(RefreshSession)
      .countBy({ userId: user.id });

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(204);

    const clearCookieHeaders = response.headers['set-cookie'] as unknown as
      string[] | undefined;

    expect(clearCookieHeaders).toHaveLength(1);
    expect(clearCookieHeaders?.[0]).toContain('refresh_token=');

    const sessionCountAfter = await dataSource
      .getRepository(RefreshSession)
      .countBy({ userId: user.id });

    expect(sessionCountAfter).toBe(sessionCountBefore);
  });
});
