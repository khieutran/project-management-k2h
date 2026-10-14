import type { AccessTokenStore } from '../auth/access-token-store';
import type { AuthResponse } from '../auth/auth.types';
import { ApiError } from './api-error';
import { requestJson } from './request-json';

export type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
};

type ApiClientDependencies = {
  tokenStore: AccessTokenStore;
  refresh(): Promise<AuthResponse>;
  onSessionRefreshed(auth: AuthResponse): void;
  onAuthenticationFailure(): void;
};

export type ApiClient = {
  refreshSession(): Promise<void>;
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
};

export function createApiClient(
  dependencies: ApiClientDependencies,
): ApiClient {
  let refreshPromise: Promise<void> | null = null;

  function clearAuthentication(): void {
    dependencies.tokenStore.clear();
    dependencies.onAuthenticationFailure();
  }

  function refreshSession(): Promise<void> {
    if (refreshPromise) {
      return refreshPromise;
    }

    const pendingRefresh = dependencies
      .refresh()
      .then((auth) => {
        dependencies.tokenStore.set(auth.accessToken);
        dependencies.onSessionRefreshed(auth);
      })
      .catch((error: unknown) => {
        clearAuthentication();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });

    refreshPromise = pendingRefresh;

    return pendingRefresh;
  }

  async function send<T>(
    path: string,
    options: ApiRequestOptions,
  ): Promise<T> {
    const { authenticated: _authenticated, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers);
    const accessToken = dependencies.tokenStore.get();

    if (options.authenticated && accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return requestJson<T>(path, {
      ...requestOptions,
      headers,
    });
  }

  return {
    refreshSession,

    async request<T>(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<T> {
      try {
        return await send<T>(path, options);
      } catch (error) {
        if (
          !options.authenticated ||
          !(error instanceof ApiError) ||
          error.statusCode !== 401
        ) {
          throw error;
        }
      }

      await refreshSession();

      try {
        return await send<T>(path, options);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          clearAuthentication();
        }

        throw error;
      }
    },
  };
}
