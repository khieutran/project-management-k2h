import type { UserRole } from '../enums/user-role.enum';

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};
