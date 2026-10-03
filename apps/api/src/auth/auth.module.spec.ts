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

describe('AuthModule', () => {
  it('imports the user and refresh-session modules', async () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as
      unknown[] | undefined;

    expect(imports).toEqual(
      expect.arrayContaining([UsersModule, RefreshSessionsModule]),
    );
  });

  it('can be compiled as a Nest feature module', async () => {
    const userRepository = {};
    const refreshSessionRepository = {};

    const configValues = {
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_PEPPER: 'test-refresh-token-pepper-at-least-32-characters',
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
      .compile();

    expect(testingModule).toBeDefined();
    expect(testingModule.get(PasswordService)).toBeInstanceOf(PasswordService);
    expect(testingModule.get(JwtService)).toBeInstanceOf(JwtService);
    expect(testingModule.get(TokenService)).toBeInstanceOf(TokenService);

    await testingModule.close();
  });
});
