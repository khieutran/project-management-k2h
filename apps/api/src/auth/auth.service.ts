import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';

import { RefreshSessionsService } from '../refresh-sessions/refresh-sessions.service';
import type { User } from '../users/entities/user.entity';
import { toSafeUser } from '../users/mappers/to-safe-user';
import { UsersService } from '../users/users.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import type { AuthSessionResult } from './types/auth-session-result.type';

type RefreshTransactionResult =
  | {
      status: 'success';
      value: AuthSessionResult;
    }
  | {
      status: 'reused';
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshSessionsService: RefreshSessionsService,
  ) {}

  async register(input: RegisterDto): Promise<AuthSessionResult> {
    const existingUser = await this.usersService.findByEmail(input.email);

    if (existingUser) {
      throw this.createEmailConflict();
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const refreshToken = this.tokenService.generateRefreshToken();
    const tokenDigest = this.tokenService.digestRefreshToken(refreshToken);
    const response = await this.dataSource.transaction(
      async (entityManager) => {
        const user = await this.createUser(input, passwordHash, entityManager);

        const refreshSession =
          await this.refreshSessionsService.createInitialSession(
            {
              userId: user.id,
              tokenDigest,
            },
            entityManager,
          );

        const accessToken = await this.tokenService.issueAccessToken({
          userId: user.id,
          sessionId: refreshSession.id,
          role: user.role,
        });

        return {
          user: toSafeUser(user),
          accessToken,
          accessTokenExpiresIn:
            this.tokenService.getAccessTokenExpiresInSeconds(),
        };
      },
    );

    return {
      response,
      refreshToken,
    };
  }

  async login(input: LoginDto): Promise<AuthSessionResult> {
    const user = await this.usersService.findByEmail(input.email); //Tim email

    if (!user) {
      throw this.createInvalidCredentials();
    }

    //Verify 2 password thong qua passwordService
    const passwordMatches = await this.passwordService.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw this.createInvalidCredentials();
    }

    const refreshToken = this.tokenService.generateRefreshToken();
    const tokenDigest = this.tokenService.digestRefreshToken(refreshToken);
    //Tao session trong transaction thong qua entityManager -> Cap phat accessToken cho User
    const response = await this.dataSource.transaction(
      async (entityManager) => {
        const refreshSession =
          await this.refreshSessionsService.createInitialSession(
            {
              userId: user.id,
              tokenDigest,
            },
            entityManager,
          );

        const accessToken = await this.tokenService.issueAccessToken({
          userId: user.id,
          sessionId: refreshSession.id,
          role: user.role,
        });

        return {
          user: toSafeUser(user),
          accessToken,
          accessTokenExpiresIn:
            this.tokenService.getAccessTokenExpiresInSeconds(),
        };
      },
    );

    return {
      response,
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<AuthSessionResult> {
    const currentTokenDigest =
      this.tokenService.digestRefreshToken(refreshToken);

    const transactionResult =
      await this.dataSource.transaction<RefreshTransactionResult>(
        async (entityManager) => {
          const currentSession =
            await this.refreshSessionsService.findByTokenDigestForUpdate(
              currentTokenDigest,
              entityManager,
            );

          if (!currentSession) {
            throw this.createInvalidRefreshToken();
          }

          if (currentSession.revokedAt) {
            if (currentSession.replacedBySessionId) {
              await this.refreshSessionsService.revokeActiveSessionsByFamilyId(
                currentSession.familyId,
                entityManager,
              );

              return { status: 'reused' };
            }

            throw this.createRevokedRefreshToken();
          }

          if (currentSession.expiresAt.getTime() <= Date.now()) {
            throw this.createExpiredRefreshToken();
          }

          const user = await this.usersService.findById(
            currentSession.userId,
            entityManager,
          );

          if (!user) {
            throw this.createInvalidRefreshToken();
          }

          const replacementRefreshToken =
            this.tokenService.generateRefreshToken();

          const replacementTokenDigest = this.tokenService.digestRefreshToken(
            replacementRefreshToken,
          );

          const replacementSession =
            await this.refreshSessionsService.rotateActiveSession(
              currentSession,
              replacementTokenDigest,
              entityManager,
            );

          const accessToken = await this.tokenService.issueAccessToken({
            userId: user.id,
            sessionId: replacementSession.id,
            role: user.role,
          });

          return {
            status: 'success',
            value: {
              response: {
                user: toSafeUser(user),
                accessToken,
                accessTokenExpiresIn:
                  this.tokenService.getAccessTokenExpiresInSeconds(),
              },
              refreshToken: replacementRefreshToken,
            },
          };
        },
      );

    if (transactionResult.status === 'reused') {
      throw this.createReusedRefreshToken();
    }

    return transactionResult.value;
  }

  private async createUser(
    input: RegisterDto,
    passwordHash: string,
    entityManager: EntityManager,
  ): Promise<User> {
    try {
      return await this.usersService.create(
        {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
        entityManager,
      );
    } catch (error) {
      if (this.isPostgresUniqueViolation(error)) {
        throw this.createEmailConflict();
      }
      throw error;
    }
  }

  private isPostgresUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as Error & {
      code?: string;
    };
    return driverError.code === '23505';
  }

  private createEmailConflict(): ConflictException {
    return new ConflictException({
      code: 'AUTH_EMAIL_ALREADY_EXISTS',
      message: 'Email này đã được sử dụng',
    });
  }

  private createInvalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không hợp lệ',
    });
  }

  private createInvalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_INVALID',
      message: 'Refresh token không hợp lệ',
    });
  }

  private createExpiredRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_EXPIRED',
      message: 'Refresh token đã hết hạn',
    });
  }

  private createRevokedRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_REVOKED',
      message: 'Refresh token đã bị thu hồi',
    });
  }

  private createReusedRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_REUSED',
      message: 'Phát hiện refresh token đã được sử dụng lại',
    });
  }
}
