import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import type { EnvironmentVariables } from '../../config/environment.schema';

export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';
const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class RefreshTokenCookieService {
  private readonly baseOptions: CookieOptions;
  private readonly maxAge: number;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.baseOptions = {
      httpOnly: true,
      secure: configService.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
      sameSite: configService.getOrThrow<'lax' | 'strict' | 'none'>(
        'AUTH_COOKIE_SAME_SITE',
      ),
      path: REFRESH_TOKEN_COOKIE_PATH,
    };

    this.maxAge =
      configService.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') *
      MILLISECONDS_PER_SECOND;
  }

  setRefreshToken(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      ...this.baseOptions,
      maxAge: this.maxAge,
    });
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, this.baseOptions);
  }
}
