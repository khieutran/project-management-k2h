import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import type { EnvironmentVariables } from '../src/config/environment.schema';
import { setupSwagger } from '../src/swagger/setup-swagger';
import { createApplicationValidationPipe } from '../src/common/validation/create-application-validation-pipe';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns API and database health without sensitive data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      environment: 'test',
    });

    expect(response.body).not.toHaveProperty('connection');
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('does not expose Swagger docs when disabled', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });
});
