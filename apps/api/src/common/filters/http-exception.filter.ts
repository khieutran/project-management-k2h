import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ExceptionPayload = {
  code?: unknown;
  message?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const formattedError = this.formatError(exception, statusCode);

    response.status(statusCode).json({
      statusCode,
      ...formattedError,
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private formatError(
    exception: unknown,
    statusCode: number,
  ): {
    code: string;
    message: string;
    details?: string[];
  } {
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
      };
    }

    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Đã xảy ra lỗi hệ thống',
      };
    }

    const payload = exception.getResponse();

    if (typeof payload === 'object' && payload !== null) {
      const structuredPayload = payload as ExceptionPayload;

      if (Array.isArray(structuredPayload.message)) {
        return {
          code: 'VALIDATION_FAILED',
          message: 'Dữ liệu đầu vào không hợp lệ',
          details: structuredPayload.message.filter(
            (message): message is string => typeof message === 'string',
          ),
        };
      }

      if (
        typeof structuredPayload.code === 'string' &&
        typeof structuredPayload.message === 'string'
      ) {
        return {
          code: structuredPayload.code,
          message: structuredPayload.message,
        };
      }
    }

    return {
      code: `HTTP_${statusCode}`,
      message: this.getSafeHttpMessage(statusCode),
    };
  }

  private getSafeHttpMessage(statusCode: number): string {
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Đã xảy ra lỗi hệ thống';
    }

    return 'Yêu cầu không thể được xử lý';
  }
}
