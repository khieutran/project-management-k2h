import type { HealthResponse } from './health.types';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController', () => {
  let check: jest.Mock;
  let controller: HealthController;

  beforeEach(() => {
    check = jest.fn();

    const healthService = {
      check,
    } as unknown as HealthService;

    controller = new HealthController(healthService);
  });

  describe('getHealth', () => {
    it('returns the result produced by HealthService', async () => {
      const response: HealthResponse = {
        status: 'ok',
        database: 'up',
        environment: 'test',
      };

      check.mockResolvedValue(response);

      await expect(controller.getHealth()).resolves.toEqual(response);
      expect(check).toHaveBeenCalledTimes(1);
    });
  });
});