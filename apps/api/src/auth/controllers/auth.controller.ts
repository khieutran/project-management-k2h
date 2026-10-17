import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { SafeUser } from '../../users/types/safe-user.type';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RefreshTokenCookieService } from '../services/refresh-token-cookie.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import type { AuthResponse } from '../types/auth-response.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: RefreshTokenCookieService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ login: true, refresh: true, demo: true })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User and auth session were created' })
  @ApiBadRequestResponse({ description: 'Registration input is invalid' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @ApiTooManyRequestsResponse({
    description: 'Registration rate limit exceeded',
  })
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
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ register: true, refresh: true, demo: true })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ description: 'Authentication succeeded' })
  @ApiBadRequestResponse({ description: 'Login input is invalid' })
  @ApiUnauthorizedResponse({ description: 'Credentials are invalid' })
  @ApiTooManyRequestsResponse({
    description: 'Login rate limit exceeded',
  })
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
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ register: true, login: true, demo: true })
  @ApiCookieAuth('refresh-token')
  @ApiOperation({ summary: 'Rotate the refresh token and issue new auth data' })
  @ApiOkResponse({ description: 'Refresh token was rotated' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid' })
  @ApiTooManyRequestsResponse({
    description: 'Refresh rate limit exceeded',
  })
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

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('refresh-token')
  @ApiOperation({ summary: 'Log out the current refresh session' })
  @ApiNoContentResponse({ description: 'Current session was logged out' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = this.cookieService.getRefreshToken(request);

    try {
      await this.authService.logout(refreshToken);
    } finally {
      this.cookieService.clearRefreshToken(response);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({ description: 'Current safe user data' })
  @ApiUnauthorizedResponse({
    description: 'Access token is invalid or expired',
  })
  me(@Req() request: AuthenticatedRequest): Promise<SafeUser> {
    return this.authService.getCurrentUser(request.user.userId);
  }

  private createMissingRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REFRESH_TOKEN_MISSING',
      message: 'Không tìm thấy refresh token',
    });
  }
}
