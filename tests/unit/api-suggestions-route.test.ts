import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/inventory/service", () => ({
  listPhotoSuggestions: vi.fn(),
}));

import { GET } from "@/app/api/suggestions/route";
import { getSession } from "@/lib/auth";
import { listPhotoSuggestions } from "@/lib/inventory/service";

const householdId = "550e8400-e29b-41d4-a716-446655440000";
const containerId = "550e8400-e29b-41d4-b716-446655440001";

describe("api/suggestions GET", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        `http://localhost/api/suggestions?householdId=${householdId}&containerId=${containerId}`,
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid query", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/suggestions?householdId=bad-uuid"),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBeTypeOf("string");
  });

  it("returns suggestions list for valid query", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(listPhotoSuggestions).mockResolvedValue([
      { id: "s1", suggestedName: "USB Cable" },
    ] as never);

    const response = await GET(
      new NextRequest(
        `http://localhost/api/suggestions?householdId=${householdId}&containerId=${containerId}&status=pending`,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      suggestions: [{ id: "s1", suggestedName: "USB Cable" }],
    });
    expect(listPhotoSuggestions).toHaveBeenCalledWith({
      userId: "u1",
      householdId,
      containerId,
      status: "pending",
    });
  });
});
