import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { RefreshSessionsService } from '../refresh-sessions/refresh-sessions.service';
import { toSafeUser } from '../users/mappers/to-safe-user';
import { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import type { AuthSessionResult } from './types/auth-session-result.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshSessionServices: RefreshSessionsService,
  ) {}

  async register(input: RegisterDto): Promise<AuthSessionResult> {
    const existingUser = await this.usersService.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictException({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
        message: 'Email này đã được sử dụng',
      });
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const refreshToken = this.tokenService.generateRefreshToken();
    const tokenDigest = this.tokenService.digestRefreshToken(refreshToken);
    const response = await this.dataSource.transaction(
      async (entityManager) => {
        const user = await this.usersService.create(
          {
            email: input.email,
            passwordHash,
            displayName: input.displayName,
          },
          entityManager,
        );

        const refreshSession =
          await this.refreshSessionServices.createInitialSession(
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
}
