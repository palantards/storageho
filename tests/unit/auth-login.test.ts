import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  dbAdmin: {
    query: {},
    execute: vi.fn(),
    update: vi.fn(),
  },
  schema: {
    users: {},
    profiles: {},
  },
}));

vi.mock("@/lib/user-sync", () => ({
  ensureUserRecord: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  ensureStripeCustomer: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signUpWithSupabase: vi.fn(),
  supabaseSignOut: vi.fn(),
}));

import {
  loginWithSupabase,
  registerWithSupabase,
  signOutSupabase,
} from "@/lib/auth";
import {
  signInWithPassword,
  signUpWithSupabase,
  supabaseSignOut,
} from "@/lib/supabase";

describe("auth login/register", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loginWithSupabase persists session on success", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      token_type: "bearer",
    } as never);

    const result = await loginWithSupabase({
      email: "u@example.com",
      password: "Password123!",
      rememberMe: false,
    });

    expect(result).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "u@example.com",
      password: "Password123!",
      rememberMe: false,
    });
  });

  it("loginWithSupabase maps invalid credentials", async () => {
    vi.mocked(signInWithPassword).mockRejectedValue(
      new Error("Invalid login credentials"),
    );

    const result = await loginWithSupabase({
      email: "u@example.com",
      password: "bad",
    });

    expect(result).toEqual({ ok: false, errorKey: "invalidCredentials" });
  });

  it("registerWithSupabase returns the created user when signup succeeds", async () => {
    vi.mocked(signUpWithSupabase).mockResolvedValue({
      user: { id: "u1", email: "u@example.com" },
      session: {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "bearer",
      },
    } as never);

    const result = await registerWithSupabase({
      email: "u@example.com",
      password: "Password123!",
      metadata: { name: "User" },
    });

    expect(result).toEqual({
      user: { id: "u1", email: "u@example.com" },
    });
    expect(signUpWithSupabase).toHaveBeenCalled();
  });

  it("registerWithSupabase maps known signup errors", async () => {
    vi.mocked(signUpWithSupabase).mockRejectedValue(
      new Error("User already registered"),
    );

    const result = await registerWithSupabase({
      email: "u@example.com",
      password: "Password123!",
    });

    expect(result).toEqual({ user: null, errorKey: "userExists" });
  });

  it("signOutSupabase revokes the current session", async () => {
    vi.mocked(supabaseSignOut).mockResolvedValue(undefined);

    await signOutSupabase();

    expect(supabaseSignOut).toHaveBeenCalledWith();
  });
});
