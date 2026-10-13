import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenCookieService } from '../services/refresh-token-cookie.service';
import type { AuthResponse } from '../types/auth-response.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: RefreshTokenCookieService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(input);

    this.cookieService.setRefreshToken(response, result.refreshToken);

    return result.response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(input);

    this.cookieService.setRefreshToken(response, result.refreshToken);

    return result.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const refreshToken = this.cookieService.getRefreshToken(request);

    if (!refreshToken) {
      this.cookieService.clearRefreshToken(response);
      throw this.createMissingRefreshToken();
    }

    try {
      const result = await this.authService.refresh(refreshToken);

      this.cookieService.setRefreshToken(response, result.refreshToken);

      return result.response;
    } catch (error) {
      this.cookieService.clearRefreshToken(response);
      throw error;
    }
  }

  private createMissingRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_MISSING',
      message: 'Không tìm thấy refresh token',
    });
  }
}
