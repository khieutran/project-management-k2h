import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { RefreshSession } from '../refresh-sessions/entities/refresh-session.entity';
import { AuthModule } from './auth.module';
import { RefreshSessionsModule } from '../refresh-sessions/refresh-sessions.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { AuthService } from './auth.service';
import { RefreshTokenCookieService } from './services/refresh-token-cookie.service';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

describe('AuthModule', () => {
  it('imports the user and refresh-session modules', async () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as
      unknown[] | undefined;

    expect(imports).toEqual(
      expect.arrayContaining([UsersModule, RefreshSessionsModule]),
    );
  });

  // Test này bảo đảm các module khác có thể tái sử dụng JwtAuthGuard để bảo vệ controller của chúng.
  it('exports the JWT authentication guard', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as
      unknown[] | undefined;

    expect(exports).toContain(JwtAuthGuard);
  });

  // Test này bảo đảm feature module khác có thể dùng RolesGuard cùng với @Roles để bảo vệ endpoint.
  it('exports the role authorization guard', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as
      unknown[] | undefined;

    expect(exports).toContain(RolesGuard);
  });

  it('can be compiled as a Nest feature module', async () => {
    const userRepository = {};
    const refreshSessionRepository = {};
    const authService = {};

    const configValues = {
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_PEPPER: 'test-refresh-token-pepper-at-least-32-characters',
      REFRESH_TOKEN_TTL_SECONDS: 604800,
      AUTH_COOKIE_SECURE: false,
      AUTH_COOKIE_SAME_SITE: 'lax' as const,
    };

    const configService = {
      getOrThrow: jest.fn((key: keyof typeof configValues) => {
        const value = configValues[key];

        if (value === undefined) {
          throw new Error(`Missing test configuration: ${key}`);
        }

        return value;
      }),
    };

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(userRepository)
      .overrideProvider(getRepositoryToken(RefreshSession))
      .useValue(refreshSessionRepository)
      .overrideProvider(ConfigService)
      .useValue(configService)
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile();

    expect(testingModule).toBeDefined();
    expect(testingModule.get(PasswordService)).toBeInstanceOf(PasswordService);
    expect(testingModule.get(JwtService)).toBeInstanceOf(JwtService);
    expect(testingModule.get(TokenService)).toBeInstanceOf(TokenService);
    expect(testingModule.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
    expect(testingModule.get(RolesGuard)).toBeInstanceOf(RolesGuard);
    expect(testingModule.get(AuthService)).toBe(authService);
    expect(testingModule.get(RefreshTokenCookieService)).toBeInstanceOf(
      RefreshTokenCookieService,
    );
    expect(testingModule.get(AuthController)).toBeInstanceOf(AuthController);

    await testingModule.close();
  });
});
