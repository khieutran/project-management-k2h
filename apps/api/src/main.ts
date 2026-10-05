import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import type { EnvironmentVariables } from './config/environment.schema';
import { setupSwagger } from './swagger/setup-swagger';
import { createApplicationValidationPipe } from './common/validation/create-application-validation-pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(createApplicationValidationPipe());

  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  const port = configService.getOrThrow<number>('API_PORT');

  const swaggerEnabled = configService.getOrThrow<boolean>('SWAGGER_ENABLED');

  app.setGlobalPrefix('api');

  setupSwagger(app, swaggerEnabled);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
