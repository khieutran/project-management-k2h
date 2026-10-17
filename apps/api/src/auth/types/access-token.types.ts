import type { UserRole } from '../../users/enums/user-role.enum';

export type IssueAccessTokenInput = {
  userId: string;
  sessionId: string;
  role: UserRole;
  expiresAt?: Date;
};

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  role: UserRole;
};

export type VerifiedAccessTokenPayload = AccessTokenPayload & {
  iat: number;
  exp: number;
};
