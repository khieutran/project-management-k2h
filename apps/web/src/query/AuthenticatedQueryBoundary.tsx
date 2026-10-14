import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/use-auth';
import { createProjectQueryClient } from './query-client';

export function AuthenticatedQueryBoundary({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const [queryClient] = useState(createProjectQueryClient);
  const actorUserId = state.status === 'authenticated' ? state.user.id : null;
  const previousActorUserId = useRef(actorUserId);

  useEffect(() => {
    if (previousActorUserId.current !== actorUserId) {
      void queryClient.cancelQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['projects'] });
      previousActorUserId.current = actorUserId;
    }
  }, [actorUserId, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
