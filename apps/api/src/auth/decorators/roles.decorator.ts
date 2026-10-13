import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../../users/enums/user-role.enum';

export const ROLES_KEY = 'auth:roles';

export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
