import { ValidationPipe } from '@nestjs/common';

export function createApplicationValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
