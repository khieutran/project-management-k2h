import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../../users/enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();

    if (!request.user) {
      throw this.createInvalidAccessToken();
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw this.createForbiddenAccess();
    }

    return true;
  }

  private createInvalidAccessToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn',
    });
  }

  private createForbiddenAccess(): ForbiddenException {
    return new ForbiddenException({
      code: 'AUTH_FORBIDDEN',
      message: 'Bạn không có quyền thực hiện thao tác này',
    });
  }
}
