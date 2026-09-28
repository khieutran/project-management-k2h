import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

export function setupSwagger(
  app: INestApplication,
  enabled: boolean,
): void {
  if (!enabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Project Management K2H API')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(
    app,
    config,
  );

  SwaggerModule.setup(
    'api/docs',
    app,
    document,
  );
}