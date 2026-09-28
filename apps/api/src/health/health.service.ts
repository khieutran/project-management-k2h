import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import type { EnvironmentVariables } from '../config/environment.schema';
import type {
  HealthResponse,
  UnhealthyResponse,
} from './health.types';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService<
      EnvironmentVariables,
      true
    >,
  ) {}

  async check(): Promise<HealthResponse> {
    const environment =
      this.configService.getOrThrow<
        EnvironmentVariables['NODE_ENV']
      >('NODE_ENV');

    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        database: 'up',
        environment,
      };
    } catch {
      const response: UnhealthyResponse = {
        status: 'error',
        database: 'down',
        environment,
      };

      throw new ServiceUnavailableException(response);
    }
  }
}