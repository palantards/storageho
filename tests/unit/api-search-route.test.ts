import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/inventory/service", () => ({
  getActiveMembershipContext: vi.fn(),
  globalSearch: vi.fn(),
  semanticSearch: vi.fn(),
}));

vi.mock("@/lib/inventory/search-fusion", () => ({
  fuseSearchResults: vi.fn(),
  buildGroundedFindAnswer: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { getSession } from "@/lib/auth";
import {
  getActiveMembershipContext,
  globalSearch,
  semanticSearch,
} from "@/lib/inventory/service";
import {
  fuseSearchResults,
  buildGroundedFindAnswer,
} from "@/lib/inventory/search-fusion";

describe("api/search GET", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/search?q=usb"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns empty payload for empty query", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });

    const response = await GET(new NextRequest("http://localhost/api/search?q="));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [], answer: null });
  });

  it("returns fused results and ai answer", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(getActiveMembershipContext).mockResolvedValue({
      memberships: [{ household: { id: "h1" } }],
      active: { household: { id: "h1" } },
    } as never);
    vi.mocked(globalSearch).mockResolvedValue([{ id: "fuzzy" }] as never);
    vi.mocked(semanticSearch).mockResolvedValue([{ id: "semantic" }] as never);
    vi.mocked(fuseSearchResults).mockReturnValue([
      { entityId: "item-1", title: "USB Cable" },
    ] as never);
    vi.mocked(buildGroundedFindAnswer).mockReturnValue({
      bestMatch: { entityId: "item-1" },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/search?q=usb&mode=ai"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      results: [{ entityId: "item-1", title: "USB Cable" }],
      answer: { bestMatch: { entityId: "item-1" } },
    });
    expect(globalSearch).toHaveBeenCalled();
    expect(semanticSearch).toHaveBeenCalled();
    expect(fuseSearchResults).toHaveBeenCalled();
    expect(buildGroundedFindAnswer).toHaveBeenCalled();
  });
});

