import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { UserRole } from '../../users/enums/user-role.enum';
import type { AuthService } from '../auth.service';
import type { LoginDto } from '../dto/login.dto';
import type { RegisterDto } from '../dto/register.dto';
import type { RefreshTokenCookieService } from '../services/refresh-token-cookie.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const registerInput: RegisterDto = {
    email: 'user@example.com',
    password: 'password-123',
    displayName: 'Nguyen Van A',
  };

  const loginInput: LoginDto = {
    email: 'user@example.com',
    password: 'password-123',
  };

  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
  };

  let cookieService: {
    getRefreshToken: jest.Mock;
    setRefreshToken: jest.Mock;
    clearRefreshToken: jest.Mock;
  };
  let request: Request;
  let response: Response;
  let authController: AuthController;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };
    cookieService = {
      getRefreshToken: jest.fn(),
      setRefreshToken: jest.fn(),
      clearRefreshToken: jest.fn(),
    };
    request = {} as Request;
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

  describe('login', () => {
    it('sets the refresh cookie and returns only the safe auth response', async () => {
      // Arrange
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

      authService.login.mockResolvedValue({
        response: authResponse,
        refreshToken: 'plaintext-refresh-token',
      });

      // Act
      const result = await authController.login(loginInput, response);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(loginInput);
      expect(cookieService.setRefreshToken).toHaveBeenCalledWith(
        response,
        'plaintext-refresh-token',
      );
      expect(result).toEqual(authResponse);
      expect(result).not.toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('does not set a refresh cookie when login fails', async () => {
      const error = new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không hợp lệ',
      });

      authService.login.mockRejectedValue(error);

      await expect(authController.login(loginInput, response)).rejects.toBe(
        error,
      );
      expect(cookieService.setRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the refresh cookie and returns only safe auth data', async () => {
      const authResponse = {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'user@example.com',
          displayName: 'Nguyen Van A',
          role: UserRole.User,
        },
        accessToken: 'replacement-access-token',
        accessTokenExpiresIn: 900,
      };

      cookieService.getRefreshToken.mockReturnValue('current-refresh-token');
      authService.refresh.mockResolvedValue({
        response: authResponse,
        refreshToken: 'replacement-refresh-token',
      });

      const result = await authController.refresh(request, response);

      expect(cookieService.getRefreshToken).toHaveBeenCalledWith(request);
      expect(authService.refresh).toHaveBeenCalledWith('current-refresh-token');
      expect(cookieService.setRefreshToken).toHaveBeenCalledWith(
        response,
        'replacement-refresh-token',
      );
      expect(cookieService.clearRefreshToken).not.toHaveBeenCalled();
      expect(result).toEqual(authResponse);
      expect(result).not.toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a missing refresh cookie and clears it', async () => {
      cookieService.getRefreshToken.mockReturnValue(undefined);

      let caughtError: unknown;

      try {
        await authController.refresh(request, response);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(UnauthorizedException);
      expect((caughtError as UnauthorizedException).getResponse()).toEqual({
        code: 'AUTH_REFRESH_TOKEN_MISSING',
        message: 'Không tìm thấy refresh token',
      });
      expect(cookieService.clearRefreshToken).toHaveBeenCalledWith(response);
      expect(authService.refresh).not.toHaveBeenCalled();
      expect(cookieService.setRefreshToken).not.toHaveBeenCalled();
    });

    it('clears the refresh cookie and preserves an auth failure', async () => {
      const error = new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_REUSED',
        message: 'Phát hiện refresh token đã được sử dụng lại',
      });

      cookieService.getRefreshToken.mockReturnValue('reused-refresh-token');
      authService.refresh.mockRejectedValue(error);

      await expect(authController.refresh(request, response)).rejects.toBe(
        error,
      );

      expect(cookieService.clearRefreshToken).toHaveBeenCalledWith(response);
      expect(cookieService.setRefreshToken).not.toHaveBeenCalled();
    });
  });
});
