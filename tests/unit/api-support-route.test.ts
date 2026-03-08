import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { insertMock, valuesMock, executeMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
  executeMock: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  applyRateLimitHeaders: vi.fn((headers: Headers, result: { limit: number; remaining: number; retryAfterSec: number }) => {
    headers.set("X-RateLimit-Limit", String(result.limit));
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("Retry-After", String(result.retryAfterSec));
  }),
}));

vi.mock("@/server/db", () => ({
  dbAdmin: {
    insert: insertMock,
  },
  schema: {
    supportRequests: {},
  },
}));

import { POST } from "@/app/api/support/route";
import { consumeRateLimit } from "@/lib/security/rate-limit";

describe("api/support POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      retryAfterSec: 600,
    });
    executeMock.mockResolvedValue({});
    valuesMock.mockReturnValue({ execute: executeMock });
    insertMock.mockReturnValue({ values: valuesMock });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/support", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid support request payload.",
    });
  });

  it("creates support request on valid payload", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/support", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          subject: "Need help",
          message: "Cannot find my box",
        }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.7",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith({
      email: "user@example.com",
      subject: "Need help",
      message: "Cannot find my box",
    });
    expect(executeMock).toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterSec: 600,
    });

    const blocked = await POST(
      new NextRequest("http://localhost/api/support", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          subject: "Need help",
          message: "Cannot find my box",
        }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.99",
        },
      }),
    );

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: "Too many support requests. Please try again later.",
    });
    expect(blocked.headers.get("Retry-After")).toBe("600");
  });
});
