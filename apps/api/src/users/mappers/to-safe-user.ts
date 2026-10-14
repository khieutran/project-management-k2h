import type { User } from '../entities/user.entity';
import type { SafeUser } from '../types/safe-user.type';

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}
