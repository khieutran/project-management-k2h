import {
  BadRequestException,
  type ArgumentsHost,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';

// Nhóm test này kiểm tra mọi exception được chuyển thành HTTP error contract thống nhất và không làm lộ lỗi nội bộ.
describe('HttpExceptionFilter', () => {
  const now = new Date('2026-10-13T10:00:00.000Z');

  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });

    const request = {
      originalUrl: '/api/auth/me',
    } as Request;
    const response = {
      status,
    } as unknown as Response;

    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    } as unknown as ArgumentsHost;

    filter = new HttpExceptionFilter();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Test này bảo đảm auth error giữ nguyên code/message nghiệp vụ và được bổ sung status, path, timestamp.
  it('formats a structured authentication exception', () => {
    filter.catch(
      new UnauthorizedException({
        code: 'AUTH_ACCESS_TOKEN_INVALID',
        message: 'Access token không hợp lệ hoặc đã hết hạn',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      code: 'AUTH_ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn',
      path: '/api/auth/me',
      timestamp: now.toISOString(),
    });
  });

  // Test này bảo đảm lỗi DTO được chuẩn hóa nhưng vẫn giữ danh sách chi tiết để frontend hiển thị đúng field.
  it('formats validation errors without exposing the original exception', () => {
    filter.catch(
      new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: ['email must be an email', 'password is too short'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Dữ liệu đầu vào không hợp lệ',
      details: ['email must be an email', 'password is too short'],
      path: '/api/auth/me',
      timestamp: now.toISOString(),
    });
  });

  // Test này bảo đảm thư viện throttler được ánh xạ thành error code ổn định cho frontend.
  it('formats a throttling exception as RATE_LIMIT_EXCEEDED', () => {
    filter.catch(new ThrottlerException(), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
      path: '/api/auth/me',
      timestamp: now.toISOString(),
    });
  });

  // Test này bảo đảm lỗi lập trình hoặc database không xác định không làm lộ stack trace hay message nội bộ.
  it('sanitizes an unexpected internal error', () => {
    filter.catch(new Error('password=secret SQL connection failed'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Đã xảy ra lỗi hệ thống',
      path: '/api/auth/me',
      timestamp: now.toISOString(),
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret');
  });
});
