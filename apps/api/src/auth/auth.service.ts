import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';

import { RefreshSessionsService } from '../refresh-sessions/refresh-sessions.service';
import { toSafeUser } from '../users/mappers/to-safe-user';
import { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import type { AuthSessionResult } from './types/auth-session-result.type';
import type { User } from '../users/entities/user.entity';

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
}
