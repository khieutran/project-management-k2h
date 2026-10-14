import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  SafeUser,
} from '../auth/auth.types';
import { ApiError } from './api-error';
import { requestJson } from './request-json';

const cookieRequest: RequestInit = {
  method: 'POST',
  credentials: 'include',
};

function jsonCookieRequest(body: unknown): RequestInit {
  return {
    ...cookieRequest,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafeUser(value: unknown): value is SafeUser {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.displayName === 'string' &&
    (value.role === 'USER' || value.role === 'ADMIN')
  );
}

function invalidApiResponse(): ApiError {
  return new ApiError(
    502,
    'INVALID_API_RESPONSE',
    'Phản hồi API không hợp lệ',
  );
}

function parseAuthResponse(value: unknown): AuthResponse {
  if (
    !isRecord(value) ||
    !isSafeUser(value.user) ||
    typeof value.accessToken !== 'string' ||
    value.accessToken.length === 0 ||
    !Number.isInteger(value.accessTokenExpiresIn) ||
    Number(value.accessTokenExpiresIn) <= 0
  ) {
    throw invalidApiResponse();
  }

  return value as AuthResponse;
}

async function requestAuthResponse(
  path: string,
  options: RequestInit,
): Promise<AuthResponse> {
  return parseAuthResponse(await requestJson<unknown>(path, options));
}

export const authApi = {
  register(input: RegisterInput): Promise<AuthResponse> {
    return requestAuthResponse('/auth/register', jsonCookieRequest(input));
  },

  login(input: LoginInput): Promise<AuthResponse> {
    return requestAuthResponse('/auth/login', jsonCookieRequest(input));
  },

  refresh(): Promise<AuthResponse> {
    return requestAuthResponse('/auth/refresh', cookieRequest);
  },

  logout(): Promise<void> {
    return requestJson('/auth/logout', cookieRequest);
  },

  async getCurrentUser(accessToken: string): Promise<SafeUser> {
    const user = await requestJson<unknown>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!isSafeUser(user)) {
      throw invalidApiResponse();
    }

    return user;
  },
};
