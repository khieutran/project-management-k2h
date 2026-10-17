import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../../config/environment.schema';
import { createAuthThrottlerOptions } from './auth-throttler.config';

// Nhóm test này kiểm tra environment được chuyển thành ba policy throttling độc lập với đơn vị millisecond đúng yêu cầu thư viện.
describe('createAuthThrottlerOptions', () => {
  // Test này bảo đảm register, login và refresh không dùng nhầm limit hoặc TTL của nhau.
  it('creates named auth throttlers from validated configuration', () => {
    const configService = new ConfigService<EnvironmentVariables, true>({
      AUTH_REGISTER_RATE_LIMIT: 3,
      AUTH_REGISTER_RATE_TTL_SECONDS: 3600,
      AUTH_LOGIN_RATE_LIMIT: 5,
      AUTH_LOGIN_RATE_TTL_SECONDS: 60,
      AUTH_REFRESH_RATE_LIMIT: 20,
      AUTH_REFRESH_RATE_TTL_SECONDS: 60,
      DEMO_RATE_LIMIT: 3,
      DEMO_RATE_TTL_SECONDS: 3600,
    });

    expect(createAuthThrottlerOptions(configService)).toEqual([
      {
        name: 'register',
        limit: 3,
        ttl: 3_600_000,
      },
      {
        name: 'login',
        limit: 5,
        ttl: 60_000,
      },
      {
        name: 'refresh',
        limit: 20,
        ttl: 60_000,
      },
      {
        name: 'demo',
        limit: 3,
        ttl: 3_600_000,
      },
    ]);
  });
});
