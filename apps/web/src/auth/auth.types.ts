export type UserRole = 'USER' | 'ADMIN';

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type AuthResponse = {
  user: SafeUser;
  accessToken: string;
  accessTokenExpiresIn: number;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  displayName: string;
};

export type AuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: SafeUser };
