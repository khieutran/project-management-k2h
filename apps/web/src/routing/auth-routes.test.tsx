import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "../auth/auth-context";
import type { AuthState } from "../auth/auth.types";
import { GuestRoute } from "./GuestRoute";
import { ProtectedRoute } from "./ProtectedRoute";

function renderRoutes(state: AuthState, initialPath: string) {
  const auth: AuthContextValue = {
    state,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    request: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<h1>Protected home</h1>} />
            <Route path="/projects" element={<h1>Project workspace</h1>} />
          </Route>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<h1>Login page</h1>} />
            <Route path="/register" element={<h1>Register page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("authentication routes", () => {
  it("hides protected content while the session is initializing", () => {
    renderRoutes({ status: "initializing" }, "/");

    expect(
      screen.getByText("Đang kiểm tra phiên đăng nhập..."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected home")).not.toBeInTheDocument();
  });

  it("redirects an unauthenticated visitor to login", () => {
    renderRoutes({ status: "unauthenticated" }, "/");

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirects an authenticated user away from guest routes", () => {
    renderRoutes(
      {
        status: "authenticated",
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "user@example.com",
          displayName: "Nguyen Van A",
          role: "USER",
        },
      },
      "/login",
    );

    expect(screen.getByText("Project workspace")).toBeInTheDocument();
  });
});
