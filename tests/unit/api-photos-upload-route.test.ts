import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/inventory/guards", () => ({
  requireHouseholdWriteAccess: vi.fn(),
}));

vi.mock("@/lib/inventory/service", () => ({
  listContainerPhotos: vi.fn(),
  insertPhotoRecord: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  applyRateLimitHeaders: vi.fn((headers: Headers, result: { limit: number; remaining: number; retryAfterSec: number }) => {
    headers.set("X-RateLimit-Limit", String(result.limit));
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("Retry-After", String(result.retryAfterSec));
  }),
}));

vi.mock("@/server/db/tenant", () => ({
  withRlsUserContext: vi.fn(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({}),
  ),
}));

import { POST } from "@/app/api/photos/upload/route";
import { getSession } from "@/lib/auth";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import { listContainerPhotos, insertPhotoRecord } from "@/lib/inventory/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

const householdId = "550e8400-e29b-41d4-a716-446655440000";
const entityId = "550e8400-e29b-41d4-b716-446655440001";

describe("api/photos/upload POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      limit: 40,
      remaining: 39,
      retryAfterSec: 60,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/photos/upload", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid payload", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/photos/upload", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid payload" });
  });

  it("returns 429 when upload rate limit is exceeded", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 40,
      remaining: 0,
      retryAfterSec: 60,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/photos/upload", { method: "POST" }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Upload rate limit exceeded. Try again in a minute.",
    });
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("uploads original + thumbnail and stores photo record", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(requireHouseholdWriteAccess).mockResolvedValue({} as never);
    vi.mocked(listContainerPhotos).mockResolvedValue([]);
    vi.mocked(insertPhotoRecord).mockResolvedValue({
      id: "photo-1",
    } as never);

    const upload = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });
    const remove = vi.fn().mockResolvedValue({});

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          upload,
          remove,
        }),
      },
    } as never);

    const form = new FormData();
    form.set("householdId", householdId);
    form.set("entityType", "container");
    form.set("entityId", entityId);
    form.set(
      "original",
      new File([new Uint8Array([1, 2, 3])], "o.png", { type: "image/png" }),
    );
    form.set(
      "thumb",
      new File([new Uint8Array([4, 5])], "t.png", { type: "image/png" }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/photos/upload", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ photo: { id: "photo-1" } });
    expect(response.headers.get("X-RateLimit-Limit")).toBe("40");
    expect(upload).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
    expect(insertPhotoRecord).toHaveBeenCalled();
  });
});
