import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../users/enums/user-role.enum';
import { ROLES_KEY, Roles } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { RolesGuard } from './roles.guard';

class TestController {
  unrestricted(): string {
    return 'unrestricted';
  }

  @Roles(UserRole.User)
  userOnly(): string {
    return 'user';
  }

  @Roles(UserRole.Admin)
  adminOnly(): string {
    return 'admin';
  }

  @Roles(UserRole.User, UserRole.Admin)
  userOrAdmin(): string {
    return 'user-or-admin';
  }
}

@Roles(UserRole.Admin)
class AdminController {
  dashboard(): string {
    return 'dashboard';
  }
}

// Nhóm test này kiểm tra @Roles lưu đúng metadata và RolesGuard thực thi quyền dựa trên principal từ JwtAuthGuard.
describe('RolesGuard', () => {
  let rolesGuard: RolesGuard;

  function createExecutionContext(
    controller: typeof TestController | typeof AdminController,
    handler: () => string,
    role?: UserRole,
  ): ExecutionContext {
    const request = role
      ? ({
          user: {
            userId: '11111111-1111-4111-8111-111111111111',
            sessionId: '22222222-2222-4222-8222-222222222222',
            role,
          },
        } as AuthenticatedRequest)
      : {};

    return {
      getClass: jest.fn().mockReturnValue(controller),
      getHandler: jest.fn().mockReturnValue(handler),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    rolesGuard = new RolesGuard(new Reflector());
  });

  // Test này bảo đảm decorator ghi danh sách role lên handler để guard có thể đọc lại ở runtime.
  it('stores the required roles as route metadata', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype.adminOnly),
    ).toEqual([UserRole.Admin]);
  });

  // Test này bảo đảm route không khai báo @Roles không bị RolesGuard áp thêm giới hạn quyền.
  it('allows a route without role metadata', () => {
    const context = createExecutionContext(
      TestController,
      TestController.prototype.unrestricted,
    );

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  // Test này bảo đảm user có đúng role yêu cầu được phép đi tiếp.
  it('allows an authenticated principal with the required role', () => {
    const context = createExecutionContext(
      TestController,
      TestController.prototype.userOnly,
      UserRole.User,
    );

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  // Test này bảo đảm một route có thể chấp nhận nhiều role và ADMIN được phép khi nằm trong danh sách đó.
  it('allows a principal matching one of multiple roles', () => {
    const context = createExecutionContext(
      TestController,
      TestController.prototype.userOrAdmin,
      UserRole.Admin,
    );

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  // Test này bảo đảm metadata đặt trên controller cũng được áp dụng cho các handler bên trong.
  it('enforces roles declared at controller level', () => {
    const context = createExecutionContext(
      AdminController,
      AdminController.prototype.dashboard,
      UserRole.Admin,
    );

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  // Test này bảo đảm user đã xác thực nhưng thiếu role nhận đúng lỗi 403 thay vì 401.
  it('rejects an authenticated principal without the required role', () => {
    const context = createExecutionContext(
      TestController,
      TestController.prototype.adminOnly,
      UserRole.User,
    );

    try {
      rolesGuard.canActivate(context);

      throw new Error('Expected an unauthorized role to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: 'AUTH_FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }
  });

  // Test này bảo đảm route yêu cầu role nhưng thiếu principal được xem là chưa xác thực và trả 401.
  it('rejects a missing authenticated principal', () => {
    const context = createExecutionContext(
      TestController,
      TestController.prototype.adminOnly,
    );

    try {
      rolesGuard.canActivate(context);

      throw new Error('Expected a missing principal to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual({
        code: 'AUTH_ACCESS_TOKEN_INVALID',
        message: 'Access token không hợp lệ hoặc đã hết hạn',
      });
    }
  });
});
