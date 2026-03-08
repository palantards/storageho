import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/inventory/guards", () => ({
  requireHouseholdMembership: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { POST } from "@/app/api/storage/signed-url/route";
import { getSession } from "@/lib/auth";
import { requireHouseholdMembership } from "@/lib/inventory/guards";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

const householdId = "550e8400-e29b-41d4-a716-446655440000";
const validPath = `household/${householdId}/container/abc/file.png`;

describe("api/storage/signed-url POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/storage/signed-url", {
        method: "POST",
        body: JSON.stringify({ path: validPath }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid path", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/storage/signed-url", {
        method: "POST",
        body: JSON.stringify({ path: "../bad/path" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid storage path" });
  });

  it("returns 403 when membership check fails", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(requireHouseholdMembership).mockRejectedValue(
      new Error("Forbidden"),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/storage/signed-url", {
        method: "POST",
        body: JSON.stringify({ path: validPath }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns signed url for authorized request", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(requireHouseholdMembership).mockResolvedValue({} as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://signed.example/file.png" },
            error: null,
          }),
        }),
      },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/storage/signed-url", {
        method: "POST",
        body: JSON.stringify({ path: validPath }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://signed.example/file.png",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
