import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

import type { EnvironmentVariables } from '../../config/environment.schema';

const MILLISECONDS_PER_SECOND = 1000;

export function createAuthThrottlerOptions(
  configService: ConfigService<EnvironmentVariables, true>,
): ThrottlerModuleOptions {
  return [
    {
      name: 'register',
      limit: configService.getOrThrow<number>('AUTH_REGISTER_RATE_LIMIT'),
      ttl:
        configService.getOrThrow<number>('AUTH_REGISTER_RATE_TTL_SECONDS') *
        MILLISECONDS_PER_SECOND,
    },
    {
      name: 'login',
      limit: configService.getOrThrow<number>('AUTH_LOGIN_RATE_LIMIT'),
      ttl:
        configService.getOrThrow<number>('AUTH_LOGIN_RATE_TTL_SECONDS') *
        MILLISECONDS_PER_SECOND,
    },
    {
      name: 'refresh',
      limit: configService.getOrThrow<number>('AUTH_REFRESH_RATE_LIMIT'),
      ttl:
        configService.getOrThrow<number>('AUTH_REFRESH_RATE_TTL_SECONDS') *
        MILLISECONDS_PER_SECOND,
    },
    {
      name: 'demo',
      limit: configService.getOrThrow<number>('DEMO_RATE_LIMIT'),
      ttl:
        configService.getOrThrow<number>('DEMO_RATE_TTL_SECONDS') *
        MILLISECONDS_PER_SECOND,
    },
  ];
}
