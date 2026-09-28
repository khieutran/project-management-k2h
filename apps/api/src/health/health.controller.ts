import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { HealthResponse } from './health.types';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Check API and database health',
  })
  @ApiOkResponse({
    description: 'API and database are healthy',
  })
  @ApiServiceUnavailableResponse({
    description: 'Database is unavailable',
  })
  getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
