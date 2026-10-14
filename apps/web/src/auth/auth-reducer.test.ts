import { describe, expect, it } from 'vitest';

import type { SafeUser } from './auth.types';
import { authReducer } from './auth-reducer';

const user: SafeUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  displayName: 'Nguyen Van A',
  role: 'USER',
};

describe('authReducer', () => {
  it('moves from initializing to authenticated with a safe user', () => {
    expect(
      authReducer(
        { status: 'initializing' },
        { type: 'sessionAuthenticated', user },
      ),
    ).toEqual({ status: 'authenticated', user });
  });

  it('clears any authenticated session', () => {
    expect(
      authReducer(
        { status: 'authenticated', user },
        { type: 'sessionCleared' },
      ),
    ).toEqual({ status: 'unauthenticated' });
  });
});
