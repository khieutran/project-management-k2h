import type { Request } from 'express';

import type { AuthenticatedPrincipal } from './authenticated-principal.type';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedPrincipal;
};
