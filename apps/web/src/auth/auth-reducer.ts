import type { AuthState, SafeUser } from './auth.types';

export type AuthAction =
  | { type: 'sessionAuthenticated'; user: SafeUser }
  | { type: 'sessionCleared' };

export function authReducer(
  state: AuthState,
  action: AuthAction,
): AuthState {
  switch (action.type) {
    case 'sessionAuthenticated':
      return {
        status: 'authenticated',
        user: action.user,
      };
    case 'sessionCleared':
      return { status: 'unauthenticated' };
    default:
      return state;
  }
}
