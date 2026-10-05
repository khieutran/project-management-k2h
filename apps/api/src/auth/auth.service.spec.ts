import { ConflictException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';

import { RefreshSession } from '../refresh-sessions/entities/refresh-session.entity';
import type { RefreshSessionsService } from '../refresh-sessions/refresh-sessions.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import type { PasswordService } from './services/password.service';
import type { TokenService } from './services/token.service';

describe('AuthService', () => {
  const registerInput: RegisterDto = {
    email: 'user@example.com',
    password: 'password-123',
    displayName: 'Nguyen Van A',
  };

  const entityManager = {} as EntityManager;

  let dataSource: { transaction: jest.Mock };

  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
  };

  let passwordService: { hash: jest.Mock };

  let tokenService: {
    generateRefreshToken: jest.Mock;
    digestRefreshToken: jest.Mock;
    issueAccessToken: jest.Mock;
    getAccessTokenExpiresInSeconds: jest.Mock;
  };

  let refreshSessionsService: {
    createInitialSession: jest.Mock;
  };

  let authService: AuthService;

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback(entityManager),
      ),
    };

    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    passwordService = {
      hash: jest.fn(),
    };

    tokenService = {
      generateRefreshToken: jest.fn(),
      digestRefreshToken: jest.fn(),
      issueAccessToken: jest.fn(),
      getAccessTokenExpiresInSeconds: jest.fn(),
    };

    refreshSessionsService = {
      createInitialSession: jest.fn(),
    };

    authService = new AuthService(
      dataSource as unknown as DataSource,
      usersService as unknown as UsersService,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
      refreshSessionsService as unknown as RefreshSessionsService,
    );
  });

  describe('register', () => {
    it('creates a user and session in one transaction and returns safe auth data', async () => {
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
        updatedAt: new Date('2026-10-05T00:00:00.000Z'),
      });

      const session = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: user.id,
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
      });

      usersService.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('argon2-password-hash');
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token',
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      usersService.create.mockResolvedValue(user);
      refreshSessionsService.createInitialSession.mockResolvedValue(session);
      tokenService.issueAccessToken.mockResolvedValue('signed-access-token');
      tokenService.getAccessTokenExpiresInSeconds.mockReturnValue(900);

      const result = await authService.register(registerInput);

      expect(passwordService.hash).toHaveBeenCalledWith('password-123');
      expect(usersService.create).toHaveBeenCalledWith(
        {
          email: 'user@example.com',
          passwordHash: 'argon2-password-hash',
          displayName: 'Nguyen Van A',
        },
        entityManager,
      );
      expect(refreshSessionsService.createInitialSession).toHaveBeenCalledWith(
        {
          userId: user.id,
          tokenDigest: 'a'.repeat(64),
        },
        entityManager,
      );
      expect(tokenService.issueAccessToken).toHaveBeenCalledWith({
        userId: user.id,
        sessionId: session.id,
        role: UserRole.User,
      });
      expect(result).toEqual({
        response: {
          user: {
            id: user.id,
            email: 'user@example.com',
            displayName: 'Nguyen Van A',
            role: UserRole.User,
          },
          accessToken: 'signed-access-token',
          accessTokenExpiresIn: 900,
        },
        refreshToken: 'plaintext-refresh-token',
      });
      expect(result.response.user).not.toHaveProperty('passwordHash');
      expect(result.response).not.toHaveProperty('refreshToken');
    });

    it('rejects an existing email before hashing or opening a transaction', async () => {
      const existingUser = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'existing-password-hash',
        displayName: 'Existing User',
        role: UserRole.User,
      });

      usersService.findByEmail.mockResolvedValue(existingUser);

      await expect(authService.register(registerInput)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
      expect(
        refreshSessionsService.createInitialSession,
      ).not.toHaveBeenCalled();
    });

    it('propagates access-token failure from inside the transaction', async () => {
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      const session = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: user.id,
      });

      usersService.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('argon2-password-hash');
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token',
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      usersService.create.mockResolvedValue(user);
      refreshSessionsService.createInitialSession.mockResolvedValue(session);
      tokenService.issueAccessToken.mockRejectedValue(
        new Error('JWT siging failed'),
      );

      await expect(authService.register(registerInput)).rejects.toThrow(
        'JWT siging failed',
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.any(Object),
        entityManager,
      );
      expect(refreshSessionsService.createInitialSession).toHaveBeenCalledWith(
        expect.any(Object),
        entityManager,
      );
    });
  });
});
