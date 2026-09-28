import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import type { EnvironmentVariables } from './config/environment.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(
    ConfigService<EnvironmentVariables, true>,
  );

  const port = configService.getOrThrow<number>('API_PORT');

  app.setGlobalPrefix('api');

  await app.listen(port, '0.0.0.0');
}
void bootstrap();
