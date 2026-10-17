import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';

import type { EnvironmentVariables } from '../../config/environment.schema';
import type {
  AccessTokenPayload,
  IssueAccessTokenInput,
  VerifiedAccessTokenPayload,
} from '../types/access-token.types';

const REFRESH_TOKEN_BYTES = 32;

@Injectable()
export class TokenService {
  private readonly refreshTokenPepper: string;
  private readonly jwtAccessSecret: string;
  private readonly jwtAccessTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.jwtAccessSecret =
      configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    this.jwtAccessTtlSeconds = configService.getOrThrow<number>(
      'JWT_ACCESS_TTL_SECONDS',
    );

    this.refreshTokenPepper = configService.getOrThrow<string>(
      'REFRESH_TOKEN_PEPPER',
    );
  }

  issueAccessToken(input: IssueAccessTokenInput): Promise<string> {
    const expiresIn = input.expiresAt
      ? Math.min(
          this.jwtAccessTtlSeconds,
          Math.max(
            1,
            Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
          ),
        )
      : this.jwtAccessTtlSeconds;
    const payload: AccessTokenPayload = {
      sub: input.userId,
      sid: input.sessionId,
      role: input.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtAccessSecret,
      expiresIn,
      algorithm: 'HS256',
    });
  }

  verifyAccessToken(accessToken: string): Promise<VerifiedAccessTokenPayload> {
    return this.jwtService.verifyAsync<VerifiedAccessTokenPayload>(
      accessToken,
      {
        secret: this.jwtAccessSecret,
        algorithms: ['HS256'],
      },
    );
  }

  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  digestRefreshToken(refreshToken: string): string {
    return createHmac('sha256', this.refreshTokenPepper)
      .update(refreshToken, 'utf8')
      .digest('hex');
  }

  getAccessTokenExpiresInSeconds(): number {
    return this.jwtAccessTtlSeconds;
  }
}
