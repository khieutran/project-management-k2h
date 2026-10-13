import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { QueryFailedError, type DataSource, type EntityManager } from 'typeorm';

import { RefreshSession } from '../refresh-sessions/entities/refresh-session.entity';
import type { RefreshSessionsService } from '../refresh-sessions/refresh-sessions.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import type { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import type { PasswordService } from './services/password.service';
import type { TokenService } from './services/token.service';

describe('AuthService', () => {
  const registerInput: RegisterDto = {
    email: 'user@example.com',
    password: 'password-123',
    displayName: 'Nguyen Van A',
  };

  const loginInput: LoginDto = {
    email: 'user@example.com',
    password: 'password-123',
  };

  const entityManager = {} as EntityManager;

  let dataSource: { transaction: jest.Mock };

  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };

  let passwordService: {
    hash: jest.Mock;
    verify: jest.Mock;
  };

  let tokenService: {
    generateRefreshToken: jest.Mock;
    digestRefreshToken: jest.Mock;
    issueAccessToken: jest.Mock;
    getAccessTokenExpiresInSeconds: jest.Mock;
  };

  let refreshSessionsService: {
    createInitialSession: jest.Mock;
    findByTokenDigestForUpdate: jest.Mock;
    rotateActiveSession: jest.Mock;
    revokeActiveSessionsByFamilyId: jest.Mock;
    revokeActiveSessionByTokenDigest: jest.Mock;
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
      findById: jest.fn(),
      create: jest.fn(),
    };

    passwordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    tokenService = {
      generateRefreshToken: jest.fn(),
      digestRefreshToken: jest.fn(),
      issueAccessToken: jest.fn(),
      getAccessTokenExpiresInSeconds: jest.fn(),
    };

    refreshSessionsService = {
      createInitialSession: jest.fn(),
      findByTokenDigestForUpdate: jest.fn(),
      rotateActiveSession: jest.fn(),
      revokeActiveSessionsByFamilyId: jest.fn(),
      revokeActiveSessionByTokenDigest: jest.fn(),
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
        new Error('JWT signing failed'),
      );

      await expect(authService.register(registerInput)).rejects.toThrow(
        'JWT signing failed',
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

    it('maps a concurrent email unique violation to an auth conflict', async () => {
      type PostgresDriverError = Error & { code: string };

      const uniqueViolation = new QueryFailedError<PostgresDriverError>(
        'INSERT INTO users ...',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
        }),
      );

      usersService.findByEmail.mockResolvedValue(null);

      passwordService.hash.mockResolvedValue('argon2-password-hash');
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token',
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      usersService.create.mockRejectedValue(uniqueViolation);

      try {
        await authService.register(registerInput);

        throw new Error('Expected registration to reject duplicate email');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);

        expect((error as ConflictException).getResponse()).toEqual({
          code: 'AUTH_EMAIL_ALREADY_EXISTS',
          message: 'Email này đã được sử dụng',
        });
      }

      expect(
        refreshSessionsService.createInitialSession,
      ).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('preserves non-unique database failures', async () => {
      const databaseError = new Error('database connection lost');

      usersService.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('argon2-password-hash');
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token',
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      usersService.create.mockRejectedValue(databaseError);

      await expect(authService.register(registerInput)).rejects.toBe(
        databaseError,
      );
    });
  });

  describe('login', () => {
    it('creates a session and returns safe auth data for valid credentials', async () => {
      // Arrange
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
        createdAt: new Date('2026-10-07T00:00:00.000Z'),
        updatedAt: new Date('2026-10-07T00:00:00.000Z'),
      });

      const session = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: user.id,
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
      });

      //Su dung mock: Resolved cho cac ham ASYNC | Return cho cac ham SYNC
      usersService.findByEmail.mockResolvedValue(user); //Gia lap Postgres tim thay User
      passwordService.verify.mockResolvedValue(true); //Gia lap Argon2 xac nhan dung password
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token', //Gia lap sinh refresh token
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64)); //Gia lap chuyen refreshtoken -> digest de luu database
      refreshSessionsService.createInitialSession.mockResolvedValue(session); //Gia lap tao session thanh con
      tokenService.issueAccessToken.mockResolvedValue('signed-access-token'); //Gia lap ky JWT session thanh cong
      tokenService.getAccessTokenExpiresInSeconds.mockReturnValue(900); //Gia lap gioi han phien dang nhap = 900

      // Act
      const result = await authService.login(loginInput);

      // Assert
      expect(usersService.findByEmail).toHaveBeenCalledWith('user@example.com');
      //Password kiem tra dung thu tu: passwordHash trong db -> Argon2 -> Result === input.password
      expect(passwordService.verify).toHaveBeenCalledWith(
        'argon2-password-hash',
        'password-123',
      );
      //Session duoc tao trong transaction thong qua entityManager va khong luu plaintext-refresh-token
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
            email: user.email,
            displayName: user.displayName,
            role: UserRole.User,
          },
          accessToken: 'signed-access-token',
          accessTokenExpiresIn: 900,
        },
        refreshToken: 'plaintext-refresh-token',
      });
      //Response khong cho lo: PasswordHash va RefreshToken
      expect(result.response.user).not.toHaveProperty('passwordHash');
      expect(result.response).not.toHaveProperty('refreshToken');
    });

    it('rejects an unknown email with generic invalid credentials', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act
      try {
        await authService.login(loginInput);

        throw new Error('Expected login to reject an unknown email');
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không hợp lệ',
        });
      }

      expect(passwordService.verify).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(
        refreshSessionsService.createInitialSession,
      ).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('rejects an incorrect password with the same generic invalid credentials', async () => {
      // Arrange
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      usersService.findByEmail.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(false);

      // Act
      try {
        await authService.login(loginInput);

        throw new Error('Expected login to reject an incorrect password');
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email hoặc mật khẩu không hợp lệ',
        });
      }

      expect(passwordService.verify).toHaveBeenCalledWith(
        'argon2-password-hash',
        'password-123',
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(
        refreshSessionsService.createInitialSession,
      ).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('passes password to verification without trimming whitespace', async () => {
      //Khai bao User gia lap TypeORM tra ve resp voi db
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@gmail.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      const password = '  password-123  ';

      usersService.findByEmail.mockResolvedValue(user); //He Thong Bao Tim Thay Email
      passwordService.verify.mockResolvedValue(false); //PasswordService bao verify false

      const input = {
        ...loginInput,
        password,
      };

      //Mong doi se bao la loi sai mk hoac password
      await expect(authService.login(input)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(passwordService.verify).toHaveBeenCalledWith(
        'argon2-password-hash',
        password,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('propagates session creation failure without issuing an access token', async () => {
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      const databaseError = new Error('database unavailable');

      usersService.findByEmail.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token',
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));

      refreshSessionsService.createInitialSession.mockRejectedValue(
        databaseError,
      );

      await expect(authService.login(loginInput)).rejects.toBe(databaseError);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('propagate session created but signing JWT failure', async () => {
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
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
      });

      const tokenError = new Error('JWT signing failed');

      usersService.findByEmail.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);
      tokenService.generateRefreshToken.mockReturnValue(
        'plaintext-refresh-token',
      );
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      refreshSessionsService.createInitialSession.mockResolvedValue(session);
      tokenService.issueAccessToken.mockRejectedValue(tokenError);

      await expect(authService.login(loginInput)).rejects.toBe(tokenError);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
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
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh session and returns new auth data', async () => {
      //Arrange
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      const currentSession = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: user.id,
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2099-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      const replacementSession = Object.assign(new RefreshSession(), {
        id: '44444444-4444-4444-8444-444444444444',
        userId: user.id,
        familyId: currentSession.familyId,
        tokenDigest: 'b'.repeat(64),
        expiresAt: new Date('2099-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      tokenService.digestRefreshToken
        .mockReturnValueOnce('a'.repeat(64))
        .mockReturnValueOnce('b'.repeat(64));

      tokenService.generateRefreshToken.mockReturnValue(
        'replacement-refresh-token',
      );
      refreshSessionsService.findByTokenDigestForUpdate.mockResolvedValue(
        currentSession,
      );
      usersService.findById.mockResolvedValue(user);
      refreshSessionsService.rotateActiveSession.mockResolvedValue(
        replacementSession,
      );
      tokenService.issueAccessToken.mockResolvedValue(
        'replacement-access-token',
      );
      tokenService.getAccessTokenExpiresInSeconds.mockReturnValue(900);

      //Act
      const result = await authService.refresh('current-refresh-token');

      //Assert
      expect(tokenService.digestRefreshToken).toHaveBeenNthCalledWith(
        1,
        'current-refresh-token',
      );
      expect(
        refreshSessionsService.findByTokenDigestForUpdate,
      ).toHaveBeenCalledWith('a'.repeat(64), entityManager);
      expect(usersService.findById).toHaveBeenCalledWith(
        user.id,
        entityManager,
      );
      expect(tokenService.generateRefreshToken).toHaveBeenCalledTimes(1);
      expect(tokenService.digestRefreshToken).toHaveBeenNthCalledWith(
        2,
        'replacement-refresh-token',
      );
      expect(refreshSessionsService.rotateActiveSession).toHaveBeenCalledWith(
        currentSession,
        'b'.repeat(64),
        entityManager,
      );

      expect(tokenService.issueAccessToken).toHaveBeenCalledWith({
        userId: user.id,
        sessionId: replacementSession.id,
        role: UserRole.User,
      });

      expect(result).toEqual({
        response: {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: UserRole.User,
          },
          accessToken: 'replacement-access-token',
          accessTokenExpiresIn: 900,
        },
        refreshToken: 'replacement-refresh-token',
      });

      expect(result.response).not.toHaveProperty('refreshToken');
      expect(result.response.user).not.toHaveProperty('passwordHash');
    });

    it('rejects an expired refresh session before creating replacement tokens', async () => {
      //Arrange
      const expiredSession = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));

      refreshSessionsService.findByTokenDigestForUpdate.mockResolvedValue(
        expiredSession,
      );

      //Act
      try {
        await authService.refresh('expired-refresh-token');

        throw new Error('Excepted expired refresh token to be rejected');
      } catch (error) {
        //Assert
        expect(error).toBeInstanceOf(UnauthorizedException);

        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token đã hết hạn',
        });
      }

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(refreshSessionsService.rotateActiveSession).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('rejects a revoked session that was not replaced', async () => {
      //Arrange
      const revokedSession = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2099-10-12T00:00:00.000Z'),
        revokedAt: new Date('2026-10-09T00:00:00.000Z'),
        replacedBySessionId: null,
      });

      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));

      refreshSessionsService.findByTokenDigestForUpdate.mockResolvedValue(
        revokedSession,
      );

      //Act
      try {
        await authService.refresh('revoked-refresh-token');

        throw new Error('Excepted revoked refresh token to be rejected');
      } catch (error) {
        //Assert
        expect(error).toBeInstanceOf(UnauthorizedException);

        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_REFRESH_TOKEN_REVOKED',
          message: 'Refresh token đã bị thu hồi',
        });
      }

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(refreshSessionsService.rotateActiveSession).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('rejects a refresh token that does not match a session', async () => {
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      refreshSessionsService.findByTokenDigestForUpdate.mockResolvedValue(null);

      try {
        await authService.refresh('unknown-refresh-token');

        throw new Error('Expected unknown refresh token to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_REFRESH_TOKEN_INVALID',
          message: 'Refresh token không hợp lệ',
        });
      }

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(refreshSessionsService.rotateActiveSession).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('rejects a refresh session whose user no longer exists', async () => {
      const currentSession = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2099-10-12T00:00:00.000Z'),
        revokedAt: null,
        replacedBySessionId: null,
      });

      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      refreshSessionsService.findByTokenDigestForUpdate.mockResolvedValue(
        currentSession,
      );
      usersService.findById.mockResolvedValue(null);

      try {
        await authService.refresh('orphaned-refresh-token');

        throw new Error('Expected orphaned refresh session to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_REFRESH_TOKEN_INVALID',
          message: 'Refresh token không hợp lệ',
        });
      }

      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(refreshSessionsService.rotateActiveSession).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('commits family revocation before rejecting a reused refresh token', async () => {
      const reusedSession = Object.assign(new RefreshSession(), {
        id: '22222222-2222-4222-8222-222222222222',
        userId: '11111111-1111-4111-8111-111111111111',
        familyId: '33333333-3333-4333-8333-333333333333',
        tokenDigest: 'a'.repeat(64),
        expiresAt: new Date('2099-10-12T00:00:00.000Z'),
        revokedAt: new Date('2026-10-09T00:00:00.000Z'),
        replacedBySessionId: '44444444-4444-4444-8444-444444444444',
      });

      let transactionCompleted = false;

      dataSource.transaction.mockImplementationOnce(
        async (callback: (manager: EntityManager) => Promise<unknown>) => {
          const result = await callback(entityManager);
          transactionCompleted = true;
          return result;
        },
      );

      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      refreshSessionsService.findByTokenDigestForUpdate.mockResolvedValue(
        reusedSession,
      );

      let caughtError: unknown;

      try {
        await authService.refresh('reused-refresh-token');
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(UnauthorizedException);
      expect((caughtError as UnauthorizedException).getResponse()).toEqual({
        code: 'AUTH_REFRESH_TOKEN_REUSED',
        message: 'Phát hiện refresh token đã được sử dụng lại',
      });
      expect(
        refreshSessionsService.revokeActiveSessionsByFamilyId,
      ).toHaveBeenCalledWith(reusedSession.familyId, entityManager);
      expect(transactionCompleted).toBe(true);
      expect(usersService.findById).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(refreshSessionsService.rotateActiveSession).not.toHaveBeenCalled();
      expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    });
  });

  // Nhóm test này kiểm tra AuthService chuyển refresh token dạng rõ thành digest trước khi yêu cầu thu hồi session.
  describe('logout', () => {
    // Test này bảo đảm plaintext refresh token không bị chuyển xuống tầng lưu trữ session.
    it('digests the refresh token and revokes its active session', async () => {
      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      refreshSessionsService.revokeActiveSessionByTokenDigest.mockResolvedValue(
        undefined,
      );

      await authService.logout('plaintext-refresh-token');

      expect(tokenService.digestRefreshToken).toHaveBeenCalledWith(
        'plaintext-refresh-token',
      );
      expect(
        refreshSessionsService.revokeActiveSessionByTokenDigest,
      ).toHaveBeenCalledWith('a'.repeat(64));
    });

    // Test này bảo đảm logout vẫn thành công khi trình duyệt không gửi refresh cookie.
    it('does nothing when the refresh token is missing', async () => {
      await expect(authService.logout(undefined)).resolves.toBeUndefined();

      expect(tokenService.digestRefreshToken).not.toHaveBeenCalled();
      expect(
        refreshSessionsService.revokeActiveSessionByTokenDigest,
      ).not.toHaveBeenCalled();
    });

    // Test này bảo đảm lỗi database không bị AuthService nuốt mất để controller có thể xử lý đúng vòng đời cookie.
    it('preserves a session revocation failure', async () => {
      const databaseError = new Error('database unavailable');

      tokenService.digestRefreshToken.mockReturnValue('a'.repeat(64));
      refreshSessionsService.revokeActiveSessionByTokenDigest.mockRejectedValue(
        databaseError,
      );

      await expect(
        authService.logout('plaintext-refresh-token'),
      ).rejects.toBe(databaseError);
    });
  });

  // Nhóm test này kiểm tra current user luôn được đọc lại từ database theo userId trong access-token principal.
  describe('getCurrentUser', () => {
    // Test này bảo đảm service trả safe user và không đưa password hash ra ngoài.
    it('returns the safe current user from the database', async () => {
      const user = Object.assign(new User(), {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
        displayName: 'Nguyen Van A',
        role: UserRole.User,
      });

      usersService.findById.mockResolvedValue(user);

      const result = await authService.getCurrentUser(user.id);

      expect(usersService.findById).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: UserRole.User,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    // Test này bảo đảm access token của user đã bị xóa không thể tiếp tục đọc profile.
    it('rejects an access token whose user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      try {
        await authService.getCurrentUser(
          '11111111-1111-4111-8111-111111111111',
        );

        throw new Error('Expected a missing current user to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toEqual({
          code: 'AUTH_ACCESS_TOKEN_INVALID',
          message: 'Access token không hợp lệ hoặc đã hết hạn',
        });
      }
    });
  });
});
