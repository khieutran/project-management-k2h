import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

import { RefreshTokenCookieService } from '../services/refresh-token-cookie.service';
import type { AuthResponse } from '../types/auth-response.type';
import { DemoService } from './demo.service';

@ApiTags('auth')
@Controller('auth')
export class DemoController {
  constructor(
    private readonly demoService: DemoService,
    private readonly cookieService: RefreshTokenCookieService,
  ) {}

  @Post('demo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ register: true, login: true, refresh: true })
  @ApiOperation({ summary: 'Create an isolated temporary demo workspace' })
  @ApiOkResponse({ description: 'Demo workspace and auth session created' })
  @ApiTooManyRequestsResponse({
    description: 'Demo creation rate limit exceeded',
  })
  async start(
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.demoService.createSession();
    this.cookieService.setRefreshToken(response, result.refreshToken);
    return result.response;
  }
}
