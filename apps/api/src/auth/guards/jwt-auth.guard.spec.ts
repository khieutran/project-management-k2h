import {
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { UserRole } from '../../users/enums/user-role.enum';
import type { TokenService } from '../services/token.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { JwtAuthGuard } from './jwt-auth.guard';

// Nhóm test này kiểm tra JwtAuthGuard biến Bearer token hợp lệ thành principal và chặn mọi request không xác thực được.
describe('JwtAuthGuard', () => {
  const validPayload = {
    sub: '11111111-1111-4111-8111-111111111111',
    sid: '22222222-2222-4222-8222-222222222222',
    role: UserRole.User,
    iat: 1_700_000_000,
    exp: 2_000_000_000,
  };

  let tokenService: {
    verifyAccessToken: jest.Mock;
  };
  let jwtAuthGuard: JwtAuthGuard;

  function createExecutionContext(
    authorization?: string,
  ): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } {
    const request = {
      headers: authorization ? { authorization } : {},
    } as Request as AuthenticatedRequest;

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    tokenService = {
      verifyAccessToken: jest.fn(),
    };

    jwtAuthGuard = new JwtAuthGuard(
      tokenService as unknown as TokenService,
    );
  });

  // Test này bảo đảm token hợp lệ được verify và chỉ các claim cần thiết được gắn vào request.user.
  it('allows a valid Bearer token and attaches an authenticated principal', async () => {
    const { context, request } = createExecutionContext(
      'Bearer signed-access-token',
    );

    tokenService.verifyAccessToken.mockResolvedValue(validPayload);

    await expect(jwtAuthGuard.canActivate(context)).resolves.toBe(true);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
      'signed-access-token',
    );
    expect(request.user).toEqual({
      userId: validPayload.sub,
      sessionId: validPayload.sid,
      role: UserRole.User,
    });
    expect(request.user).not.toHaveProperty('iat');
    expect(request.user).not.toHaveProperty('exp');
  });

  // Test này bảo đảm tên scheme không phân biệt chữ hoa chữ thường theo chuẩn HTTP Authorization.
  it('accepts a case-insensitive Bearer scheme', async () => {
    const { context } = createExecutionContext('bearer signed-access-token');

    tokenService.verifyAccessToken.mockResolvedValue(validPayload);

    await expect(jwtAuthGuard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
      'signed-access-token',
    );
  });

  // Test này bảo đảm request thiếu Authorization header bị từ chối trước khi gọi thư viện JWT.
  it('rejects a missing Authorization header', async () => {
    const { context } = createExecutionContext();

    await expect(jwtAuthGuard.canActivate(context)).rejects.toMatchObject({
      response: {
        code: 'AUTH_ACCESS_TOKEN_INVALID',
        message: 'Access token không hợp lệ hoặc đã hết hạn',
      },
    });
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  // Test này bao phủ các header sai contract: sai scheme, thiếu token hoặc chứa nhiều hơn một token.
  it.each([
    'Basic signed-access-token',
    'Bearer',
    'Bearer signed-access-token unexpected-value',
  ])('rejects a malformed Authorization header: %s', async (authorization) => {
    const { context } = createExecutionContext(authorization);

    await expect(jwtAuthGuard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  // Test này bảo đảm lỗi chữ ký, token hết hạn hoặc lỗi JWT nội bộ đều được trả về dưới một auth error an toàn.
  it('maps access-token verification failure to a sanitized auth error', async () => {
    const { context } = createExecutionContext(
      'Bearer forged-or-expired-token',
    );

    tokenService.verifyAccessToken.mockRejectedValue(
      new Error('jwt signature is invalid'),
    );

    await expect(jwtAuthGuard.canActivate(context)).rejects.toMatchObject({
      response: {
        code: 'AUTH_ACCESS_TOKEN_INVALID',
        message: 'Access token không hợp lệ hoặc đã hết hạn',
      },
    });
  });

  // Test này bảo đảm JWT có chữ ký đúng nhưng thiếu hoặc sai claim bắt buộc vẫn không thể tạo principal.
  it.each([
    { ...validPayload, sub: '' },
    { ...validPayload, sid: 123 },
    { ...validPayload, role: 'OWNER' },
    { ...validPayload, iat: undefined },
    { ...validPayload, exp: undefined },
  ])('rejects an invalid access-token payload: %j', async (payload) => {
    const { context, request } = createExecutionContext(
      'Bearer signed-access-token',
    );

    tokenService.verifyAccessToken.mockResolvedValue(payload);

    await expect(jwtAuthGuard.canActivate(context)).rejects.toMatchObject({
      response: {
        code: 'AUTH_ACCESS_TOKEN_INVALID',
      },
    });
    expect(request.user).toBeUndefined();
  });
});
