import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { UserRole } from '../../users/enums/user-role.enum';
import { TokenService } from '../services/token.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import type { VerifiedAccessTokenPayload } from '../types/access-token.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const accessToken = this.extractBearerToken(request);

    if (!accessToken) {
      throw this.createInvalidAccessToken();
    }

    let payload: unknown;

    try {
      payload = await this.tokenService.verifyAccessToken(accessToken);
    } catch {
      throw this.createInvalidAccessToken();
    }

    if (!this.isVerifiedAccessTokenPayload(payload)) {
      throw this.createInvalidAccessToken();
    }

    (request as AuthenticatedRequest).user = {
      userId: payload.sub,
      sessionId: payload.sid,
      role: payload.role,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const parts = authorization.trim().split(/\s+/);

    if (
      parts.length !== 2 ||
      parts[0]?.toLowerCase() !== 'bearer' ||
      !parts[1]
    ) {
      return null;
    }

    return parts[1];
  }

  private isVerifiedAccessTokenPayload(
    payload: unknown,
  ): payload is VerifiedAccessTokenPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Partial<VerifiedAccessTokenPayload>;

    return (
      typeof candidate.sub === 'string' &&
      candidate.sub.length > 0 &&
      typeof candidate.sid === 'string' &&
      candidate.sid.length > 0 &&
      Object.values(UserRole).includes(candidate.role as UserRole) &&
      Number.isInteger(candidate.iat) &&
      Number.isInteger(candidate.exp)
    );
  }

  private createInvalidAccessToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn',
    });
  }
}
