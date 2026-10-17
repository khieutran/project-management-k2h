import { afterEach, describe, expect, it, vi } from "vitest";

import { authApi } from "./auth-api";
import { ApiError } from "./api-error";

const authResponse = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
    displayName: "Nguyen Van A",
    role: "USER" as const,
  },
  accessToken: "signed-access-token",
  accessTokenExpiresIn: 900,
};

describe("authApi", () => {
  it("starts demo without sending credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "demo-1",
            email: "demo@demo.k2h.invalid",
            displayName: "Khách trải nghiệm",
            role: "USER",
          },
          accessToken: "demo-access",
          accessTokenExpiresIn: 900,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(authApi.demo()).resolves.toMatchObject({
      accessToken: "demo-access",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/demo",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs in with JSON and includes the refresh cookie contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(authResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authApi.login({
        email: "user@example.com",
        password: "password-123",
      }),
    ).resolves.toEqual(authResponse);

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password-123",
      }),
    });
  });

  it("refreshes using only the HttpOnly cookie", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(authResponse), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(authApi.refresh()).resolves.toEqual(authResponse);

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
  });

  it("registers the complete account input without adding extra fields", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(authResponse), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await authApi.register({
      email: "user@example.com",
      password: "password-123",
      displayName: "Nguyen Van A",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password-123",
        displayName: "Nguyen Van A",
      }),
    });
  });

  it("reads the current user using a Bearer access token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(authResponse.user), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authApi.getCurrentUser("signed-access-token"),
    ).resolves.toEqual(authResponse.user);

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      headers: { Authorization: "Bearer signed-access-token" },
    });
  });

  it("rejects a malformed successful auth response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: authResponse.user,
          accessTokenExpiresIn: 900,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authApi.login({
        email: "user@example.com",
        password: "password-123",
      }),
    ).rejects.toEqual(
      new ApiError(502, "INVALID_API_RESPONSE", "Phản hồi API không hợp lệ"),
    );
  });

  it("logs out with the refresh cookie and supports an empty response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(authApi.logout()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });
});
