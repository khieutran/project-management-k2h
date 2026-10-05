import type { AuthResponse } from './auth-response.type';

export type AuthSessionResult = {
  response: AuthResponse;
  refreshToken: string;
};
