import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { EnvironmentVariables } from '../../config/environment.schema';
import { TokenService } from './token.service';
import { UserRole } from '../../users/enums/user-role.enum';

describe('TokenService', () => {
  const refreshTokenPepper = 'test-refresh-token-pepper-at-least-32-characters';

  const jwtAccessSecret = 'test-jwt-access-at-least-32-characters';

  const jwtAccessTtlSeconds = 900;

  const jwtService = new JwtService();

  const configService = new ConfigService<EnvironmentVariables, true>({
    REFRESH_TOKEN_PEPPER: refreshTokenPepper,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_ACCESS_TTL_SECONDS: jwtAccessTtlSeconds,
  });

  const tokenService = new TokenService(jwtService, configService);

  describe('generateRefreshToken', () => {
    it('generates an opaque base64url token containing 32 random bytes', () => {
      const refreshToken = tokenService.generateRefreshToken();

      expect(refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(Buffer.from(refreshToken, 'base64url')).toHaveLength(32);
    });

    it('generates a different refresh token each time', () => {
      const firstToken = tokenService.generateRefreshToken();

      const secondToken = tokenService.generateRefreshToken();

      expect(firstToken).not.toBe(secondToken);
    });
  });

  describe('digestRefreshToken', () => {
    it('creates the expected HMAC-SHA-256 hexadecimal digest', () => {
      const digest = tokenService.digestRefreshToken('refresh-token-value');

      expect(digest).toBe(
        'a5bfe7350325f3d1fbeb45f04553820b270e9e0914fdb272d2ab9956207e0a89',
      );
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    });

    it('creates a different digest when the pepper changes', () => {
      const otherConfigService = new ConfigService<EnvironmentVariables, true>({
        REFRESH_TOKEN_PEPPER:
          'different-refresh-token-pepper-at-least-32-characters',
        JWT_ACCESS_SECRET: jwtAccessSecret,
        JWT_ACCESS_TTL_SECONDS: jwtAccessTtlSeconds,
      });

      const otherTokenService = new TokenService(
        jwtService,
        otherConfigService,
      );

      const refreshToken = 'same-refresh-token';

      expect(tokenService.digestRefreshToken(refreshToken)).not.toBe(
        otherTokenService.digestRefreshToken(refreshToken),
      );
    });
  });

  describe('issueAccessToken', () => {
    it('issues a signed JWT with the required claims and TTL', async () => {
      const accessToken = await tokenService.issueAccessToken({
        userId: '11111111-1111-4111-8111-111111111111',
        sessionId: '22222222-2222-4222-8222-222222222222',
        role: UserRole.User,
      });

      const payload = await jwtService.verifyAsync<{
        sub: string;
        sid: string;
        role: UserRole;
        iat: number;
        exp: number;
      }>(accessToken, {
        secret: jwtAccessSecret,
        algorithms: ['HS256'],
      });

      expect(payload).toMatchObject({
        sub: '11111111-1111-4111-8111-111111111111',
        sid: '22222222-2222-4222-8222-222222222222',
        role: UserRole.User,
      });

      expect(payload).not.toHaveProperty('email');
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('passwordHash');
      expect(payload.exp - payload.iat).toBe(jwtAccessTtlSeconds);
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the verified claims from a valid access token', async () => {
      const accessToken = await tokenService.issueAccessToken({
        userId: '11111111-1111-4111-8111-111111111111',
        sessionId: '22222222-2222-4222-8222-222222222222',
        role: UserRole.User,
      });

      await expect(
        tokenService.verifyAccessToken(accessToken),
      ).resolves.toMatchObject({
        sub: '11111111-1111-4111-8111-111111111111',
        sid: '22222222-2222-4222-8222-222222222222',
        role: UserRole.User,
      });
    });

    it('rejects an access token signed with another secret', async () => {
      const forgedAccessToken = await jwtService.signAsync(
        {
          sub: '11111111-1111-4111-8111-111111111111',
          sid: '22222222-2222-4222-8222-222222222222',
          role: UserRole.User,
        },
        {
          secret: 'another-jwt-secret-at-least-32-characters',
          expiresIn: jwtAccessTtlSeconds,
          algorithm: 'HS256',
        },
      );

      await expect(
        tokenService.verifyAccessToken(forgedAccessToken),
      ).rejects.toThrow();
    });

    it('rejects an expired access token', async () => {
      const expiredAccessToken = await jwtService.signAsync(
        {
          sub: '11111111-1111-4111-8111-111111111111',
          sid: '22222222-2222-4222-8222-222222222222',
          role: UserRole.User,
        },
        {
          secret: jwtAccessSecret,
          expiresIn: -1,
          algorithm: 'HS256',
        },
      );

      await expect(
        tokenService.verifyAccessToken(expiredAccessToken),
      ).rejects.toThrow();
    });
  });

  describe('getAccessTokenExpiresInSeconds', () => {
    it('returns the configured access-token TTL', () => {
      expect(tokenService.getAccessTokenExpiresInSeconds()).toBe(
        jwtAccessTtlSeconds,
      );
    });
  });
});
