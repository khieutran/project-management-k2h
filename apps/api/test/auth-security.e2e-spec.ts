import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource, Like } from 'typeorm';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/services/password.service';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { User } from '../src/users/entities/user.entity';

// Nhóm E2E này kiểm tra error contract và rate limit thực tế qua HTTP thay vì chỉ kiểm tra metadata decorator.
describe('Auth HTTP security contract (e2e)', () => {
  const loginEmail = 'rate-limit-login-e2e@example.com';
  const password = 'rate-limit-password-123';

  let app: INestApplication;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  async function removeTestUsers(): Promise<void> {
    await dataSource.getRepository(User).delete([
      { email: loginEmail },
      { email: Like('rate-limit-register-%@example.com') },
    ]);
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
    passwordService = app.get(PasswordService);
  });

  beforeEach(async () => {
    await removeTestUsers();
  });

  afterEach(async () => {
    await removeTestUsers();
  });

  afterAll(async () => {
    await removeTestUsers();
    await app.close();
  });

  // Test này bảo đảm request register thứ tư từ cùng IP bị chặn theo policy 3 request mỗi giờ.
  it('rate limits registration independently', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `rate-limit-register-${attempt}@example.com`,
          password,
          displayName: `Rate Limit Register ${attempt}`,
        })
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'rate-limit-register-4@example.com',
        password,
        displayName: 'Rate Limit Register 4',
      })
      .expect(429);

    expect(response.body).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      path: '/api/auth/register',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  // Test này bảo đảm login sai lần thứ sáu bị chặn theo policy riêng 5 request mỗi phút.
  it('rate limits login independently', async () => {
    const usersRepository = dataSource.getRepository(User);
    const passwordHash = await passwordService.hash(password);

    await usersRepository.save(
      usersRepository.create({
        email: loginEmail,
        passwordHash,
        displayName: 'Rate Limit Login User',
      }),
    );

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: loginEmail,
          password: `incorrect-password-${attempt}`,
        })
        .expect(401);
    }

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password: 'incorrect-password-6',
      })
      .expect(429);

    expect(response.body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      path: '/api/auth/login',
    });
  });

  // Test này bảo đảm refresh có policy riêng 20 request mỗi phút kể cả khi cookie bị thiếu.
  it('rate limits refresh independently', async () => {
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    }

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .expect(429);

    expect(response.body).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      path: '/api/auth/refresh',
    });
  });
});
