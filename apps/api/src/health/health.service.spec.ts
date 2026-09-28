import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';

import type { EnvironmentVariables } from '../config/environment.schema';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let query: jest.Mock;
  let service: HealthService;

  beforeEach(() => {
    query = jest.fn();

    const dataSource = {
      query,
    } as unknown as DataSource;

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test'),
    } as unknown as ConfigService<EnvironmentVariables, true>;

    service = new HealthService(dataSource, configService);
  });

  describe('check', () => {
    it('returns an OK response when PostgreSQL is reachable', async () => {
      query.mockResolvedValue([{ '?column?': 1 }]);

      await expect(service.check()).resolves.toEqual({
        status: 'ok',
        database: 'up',
        environment: 'test',
      });

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns a sanitized unavailable error when PostgreSQL fails', async () => {
      const sensitiveError =
        'postgresql://project_management:secret-password@localhost:5433';

      query.mockRejectedValue(new Error(sensitiveError));

      let thrownError: unknown;

      try {
        await service.check();
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ServiceUnavailableException);

      const exception = thrownError as ServiceUnavailableException;
      const response = exception.getResponse();

      expect(response).toEqual({
        status: 'error',
        database: 'down',
        environment: 'test',
      });

      expect(JSON.stringify(response)).not.toContain('secret-password');
      expect(JSON.stringify(response)).not.toContain('postgresql://');
    });
  });
})