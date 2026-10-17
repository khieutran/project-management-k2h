import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../auth/use-auth";
import { AuthLoading } from "./AuthLoading";

export function GuestRoute() {
  const { state } = useAuth();

  if (state.status === "initializing") {
    return <AuthLoading />;
  }

  if (state.status === "authenticated") {
    return <Navigate to="/projects" replace />;
  }

  return <Outlet />;
}
