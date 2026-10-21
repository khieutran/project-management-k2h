import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/api-error";
import { AuthContext, type AuthContextValue } from "../auth/auth-context";
import { LoginPage } from "./LoginPage";

function renderLogin(
  login: AuthContextValue["login"] = vi.fn().mockResolvedValue(undefined),
  fromPath: string | null = "/projects/42",
) {
  const auth: AuthContextValue = {
    state: { status: "unauthenticated" },
    login,
    register: vi.fn(),
    logout: vi.fn(),
    request: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: { from: { pathname: fromPath } },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Safe home</h1>} />
          <Route path="/projects" element={<h1>Demo projects</h1>} />
          <Route path="/projects/42" element={<h1>Requested project</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("LoginPage", () => {
  it("starts an isolated demo and opens the project list in one click", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(login);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Trải nghiệm demo" }));

    expect(await screen.findByText("Demo projects")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith("demo");
  });
  it("opens projects after a normal login without a requested destination", async () => {
    renderLogin(vi.fn().mockResolvedValue(undefined), null);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password-123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByText("Demo projects")).toBeInTheDocument();
  });
  it("shows an email validation error and keeps submit disabled", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Mật khẩu"), "password-123");
    await user.tab();

    expect(screen.getByText("Email không đúng định dạng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeDisabled();
  });

  it("logs in without trimming the password and returns to the requested page", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLogin(login);

    await user.type(screen.getByLabelText("Email"), " User@Example.com ");
    await user.type(screen.getByLabelText("Mật khẩu"), "  password-123  ");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Requested project")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "  password-123  ",
    });
  });

  it("shows the same generic message for invalid credentials", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          401,
          "AUTH_INVALID_CREDENTIALS",
          "Thông tin đăng nhập không hợp lệ",
        ),
      );
    const user = userEvent.setup();
    renderLogin(login);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(
      await screen.findByText("Email hoặc mật khẩu không hợp lệ"),
    ).toBeInTheDocument();
  });

  it("falls back to home for a protocol-relative return location", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLogin(login, "//example.com");

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password-123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Demo projects")).toBeInTheDocument();
  });

  it("prevents duplicate submission while login is pending", async () => {
    const login = vi.fn(() => new Promise<void>(() => undefined));
    const user = userEvent.setup();
    renderLogin(login);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password-123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    const pendingButton = screen.getByRole("button", {
      name: "Đang đăng nhập...",
    });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(login).toHaveBeenCalledTimes(1);
  });
});
