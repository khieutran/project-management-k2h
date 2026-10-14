import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';

import { createApiClient } from '../api/api-client';
import { authApi } from '../api/auth-api';
import { createAccessTokenStore } from './access-token-store';
import { AuthContext, type AuthContextValue } from './auth-context';
import { authReducer } from './auth-reducer';
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
} from './auth.types';

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, {
    status: 'initializing',
  });
  const [tokenStore] = useState(createAccessTokenStore);

  const commitSession = useCallback((auth: AuthResponse): void => {
    tokenStore.set(auth.accessToken);
    dispatch({ type: 'sessionAuthenticated', user: auth.user });
  }, [tokenStore]);

  const clearSession = useCallback((): void => {
    tokenStore.clear();
    dispatch({ type: 'sessionCleared' });
  }, [tokenStore]);

  const apiClient = useMemo(
    () =>
      createApiClient({
        tokenStore,
        refresh: authApi.refresh,
        onSessionRefreshed: commitSession,
        onAuthenticationFailure: clearSession,
      }),
    [clearSession, commitSession, tokenStore],
  );

  useEffect(() => {
    void apiClient.refreshSession().catch(() => undefined);
  }, [apiClient]);

  const login = useCallback(
    async (input: LoginInput): Promise<void> => {
      commitSession(await authApi.login(input));
    },
    [commitSession],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<void> => {
      commitSession(await authApi.register(input));
    },
    [commitSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      register,
      logout,
      request: apiClient.request,
    }),
    [apiClient.request, login, logout, register, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
