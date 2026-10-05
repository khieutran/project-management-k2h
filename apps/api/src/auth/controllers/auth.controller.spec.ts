import { ConflictException } from '@nestjs/common';
import type { Response } from 'express';

import { UserRole } from '../../users/enums/user-role.enum';
import type { AuthService } from '../auth.service';
import type { RegisterDto } from '../dto/register.dto';
import type { RefreshTokenCookieService } from '../services/refresh-token-cookie.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const registerInput: RegisterDto = {
    email: 'user@example.com',
    password: 'password-123',
    displayName: 'Nguyen Van A',
  };

  let authService: {
    register: jest.Mock;
  };

  let cookieService: { setRefreshToken: jest.Mock };
  let response: Response;
  let authController: AuthController;

  beforeEach(() => {
    authService = { register: jest.fn() };
    cookieService = { setRefreshToken: jest.fn() };
    response = {} as Response;
    authController = new AuthController(
      authService as unknown as AuthService,
      cookieService as unknown as RefreshTokenCookieService,
    );
  });

  describe('register', () => {
    it('sets the refresh cookie and returns only the safe auth response', async () => {
      const authResponse = {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'user@example.com',
          displayName: 'Nguyen Van A',
          role: UserRole.User,
        },
        accessToken: 'signed-access-token',
        accessTokenExpiresIn: 900,
      };

      authService.register.mockResolvedValue({
        response: authResponse,
        refreshToken: 'plaintext-refresh-token',
      });

      const result = await authController.register(registerInput, response);

      expect(authService.register).toHaveBeenCalledWith(registerInput);
      expect(cookieService.setRefreshToken).toHaveBeenCalledWith(
        response,
        'plaintext-refresh-token',
      );
      expect(result).toEqual(authResponse);
      expect(result).not.toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('does not set a cookie when registration fails', async () => {
      const error = new ConflictException({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
        message: 'Email này đã được sử dụng',
      });

      authService.register.mockRejectedValue(error);

      await expect(
        authController.register(registerInput, response),
      ).rejects.toBe(error);

      expect(cookieService.setRefreshToken).not.toHaveBeenCalled();
    });
  });
});
