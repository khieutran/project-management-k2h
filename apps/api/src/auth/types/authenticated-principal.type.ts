import type { UserRole } from '../../users/enums/user-role.enum';

export type AuthenticatedPrincipal = {
  userId: string;
  sessionId: string;
  role: UserRole;
};
