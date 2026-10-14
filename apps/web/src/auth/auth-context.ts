import { createContext } from 'react';

import type { ApiClient } from '../api/api-client';
import type {
  AuthState,
  LoginInput,
  RegisterInput,
} from './auth.types';

export type AuthContextValue = {
  state: AuthState;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  request: ApiClient['request'];
};

export const AuthContext = createContext<AuthContextValue | null>(null);
