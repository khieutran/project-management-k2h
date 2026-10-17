import type { Response } from 'express';

import type { RefreshTokenCookieService } from '../services/refresh-token-cookie.service';
import type { DemoService } from './demo.service';
import { DemoController } from './demo.controller';

describe('DemoController', () => {
  it('returns an authenticated demo session and sets the refresh cookie', async () => {
    const result = {
      response: {
        user: { id: 'demo-user' },
        accessToken: 'access',
        accessTokenExpiresIn: 900,
      },
      refreshToken: 'refresh',
    };
    const service = { createSession: jest.fn().mockResolvedValue(result) };
    const cookies = { setRefreshToken: jest.fn() };
    const response = {} as Response;
    const controller = new DemoController(
      service as unknown as DemoService,
      cookies as unknown as RefreshTokenCookieService,
    );

    await expect(controller.start(response)).resolves.toEqual(result.response);
    expect(cookies.setRefreshToken).toHaveBeenCalledWith(response, 'refresh');
  });
});
