import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/use-auth';
import { AuthLoading } from './AuthLoading';

export function ProtectedRoute() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'initializing') {
    return <AuthLoading />;
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
