import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { EnvironmentVariables } from '../../config/environment.schema';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  RefreshTokenCookieService,
} from './refresh-token-cookie.service';

describe('RefreshTokenCookieService', () => {
  const refreshTokenTtlSeconds = 604800;

  let response: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  beforeEach(() => {
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  });

  it('sets the refresh token using the configured secure cookie policy', () => {
    const configService = new ConfigService<EnvironmentVariables, true>({
      REFRESH_TOKEN_TTL_SECONDS: refreshTokenTtlSeconds,
      AUTH_COOKIE_SECURE: true,
      AUTH_COOKIE_SAME_SITE: 'lax',
    });

    const cookieService = new RefreshTokenCookieService(configService);

    cookieService.setRefreshToken(
      response as unknown as Response,
      'plaintext-refresh-token',
    );

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      'plaintext-refresh-token',
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 604_800_000,
      },
    );
  });

  it('allows insecure cookies for local HTTP when configured', () => {
    const configService = new ConfigService<EnvironmentVariables, true>({
      REFRESH_TOKEN_TTL_SECONDS: refreshTokenTtlSeconds,
      AUTH_COOKIE_SECURE: false,
      AUTH_COOKIE_SAME_SITE: 'lax',
    });

    const cookieService = new RefreshTokenCookieService(configService);

    cookieService.setRefreshToken(
      response as unknown as Response,
      'local-refresh-token',
    );

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      'local-refresh-token',
      expect.objectContaining({
        secure: false,
      }),
    );
  });

  it('clears the refresh cookie using the same cookie scope', () => {
    const configService = new ConfigService<EnvironmentVariables, true>({
      REFRESH_TOKEN_TTL_SECONDS: refreshTokenTtlSeconds,
      AUTH_COOKIE_SECURE: true,
      AUTH_COOKIE_SAME_SITE: 'strict',
    });

    const cookieService = new RefreshTokenCookieService(configService);

    cookieService.clearRefreshToken(response as unknown as Response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/auth',
      },
    );

    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('reads the refresh token from parsed request cookies', () => {
    const configService = new ConfigService<EnvironmentVariables, true>({
      REFRESH_TOKEN_TTL_SECONDS: refreshTokenTtlSeconds,
      AUTH_COOKIE_SECURE: true,
      AUTH_COOKIE_SAME_SITE: 'lax',
    });

    const cookieService = new RefreshTokenCookieService(configService);
    const request = {
      cookies: {
        [REFRESH_TOKEN_COOKIE_NAME]: 'plaintext-refresh-token',
      },
    } as unknown as Request;

    expect(cookieService.getRefreshToken(request)).toBe(
      'plaintext-refresh-token',
    );
  });
});
