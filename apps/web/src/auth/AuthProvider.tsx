import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { createApiClient } from "../api/api-client";
import { authApi } from "../api/auth-api";
import { createAccessTokenStore } from "./access-token-store";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { authReducer } from "./auth-reducer";
import { AuthEntranceTransition, ENTRANCE_COVER_MS, ENTRANCE_DURATION_MS } from "./AuthEntranceTransition";
import type { AuthResponse, LoginInput, RegisterInput } from "./auth.types";

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, {
    status: "initializing",
  });
  const [tokenStore] = useState(createAccessTokenStore);
  const [isEntering, setIsEntering] = useState(false);
  const entranceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (entranceTimer.current !== null) clearTimeout(entranceTimer.current);
  }, []);

  const commitSession = useCallback(
    (auth: AuthResponse): void => {
      tokenStore.set(auth.accessToken);
      dispatch({ type: "sessionAuthenticated", user: auth.user });
    },
    [tokenStore],
  );

  const clearSession = useCallback((): void => {
    tokenStore.clear();
    dispatch({ type: "sessionCleared" });
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
    async (input: LoginInput | "demo"): Promise<void> => {
      const auth = await (input === "demo" ? authApi.demo() : authApi.login(input));
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setIsEntering(true);
        if (entranceTimer.current !== null) clearTimeout(entranceTimer.current);
        await new Promise<void>((resolve) => {
          entranceTimer.current = setTimeout(() => {
            entranceTimer.current = null;
            resolve();
          }, ENTRANCE_COVER_MS);
        });
        commitSession(auth);
        entranceTimer.current = setTimeout(() => {
          setIsEntering(false);
          entranceTimer.current = null;
        }, ENTRANCE_DURATION_MS - ENTRANCE_COVER_MS);
        return;
      }
      commitSession(auth);
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

  return <AuthContext.Provider value={value}>{children}{isEntering && <AuthEntranceTransition />}</AuthContext.Provider>;
}
