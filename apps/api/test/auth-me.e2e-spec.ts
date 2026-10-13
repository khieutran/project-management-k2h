import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

// Nhóm E2E này kiểm tra toàn bộ luồng Bearer token -> JwtAuthGuard -> AuthService -> PostgreSQL của endpoint /auth/me.
describe('Current user endpoint (e2e)', () => {
  const email = 'current-user-e2e@example.com';
  const password = 'current-user-password-123';

  let app: INestApplication;
  let dataSource: DataSource;

  async function removeTestUser(): Promise<void> {
    await dataSource.getRepository(User).delete({ email });
  }

  async function registerAndGetAccessToken(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        displayName: 'Current User E2E',
      })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));

    return response.body.accessToken as string;
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

  // Test này bảo đảm access token hợp lệ trả user mới nhất từ database mà không lộ dữ liệu nhạy cảm.
  it('returns the safe current user for a valid access token', async () => {
    const accessToken = await registerAndGetAccessToken();
    const persistedUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: persistedUser.id,
      email,
      displayName: 'Current User E2E',
      role: UserRole.User,
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenDigest');
    expect(response.body).not.toHaveProperty('accessToken');
  });

  // Test này bảo đảm request không có Authorization header bị guard chặn trước khi chạy controller.
  it('rejects a request without an access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn',
    });
  });

  // Test này bảo đảm token giả không làm lộ lỗi kỹ thuật từ thư viện JWT.
  it('rejects a forged access token with a sanitized auth error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer forged-access-token')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn',
    });
    expect(JSON.stringify(response.body)).not.toContain('jwt');
  });

  // Test này bảo đảm JWT còn hạn cũng bị từ chối nếu user tương ứng không còn tồn tại trong database.
  it('rejects an access token whose user has been deleted', async () => {
    const accessToken = await registerAndGetAccessToken();

    await dataSource.getRepository(User).delete({ email });

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn',
    });
  });
});
