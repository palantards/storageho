import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/inventory/csv", () => ({
  commitInventoryCsv: vi.fn(),
}));

vi.mock("@/lib/inventory/service", () => ({
  getActiveMembershipContext: vi.fn(),
}));

vi.mock("@/lib/inventory/guards", () => ({
  requireHouseholdWriteAccess: vi.fn(),
}));

import { POST } from "@/app/api/import/commit/route";
import { getSession } from "@/lib/auth";
import { commitInventoryCsv } from "@/lib/inventory/csv";
import { getActiveMembershipContext } from "@/lib/inventory/service";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";

const householdId = "550e8400-e29b-41d4-a716-446655440000";

const body = {
  householdId,
  rows: [
    {
      location: "Floor 1",
      room: "Storage",
      containerPath: "Box A",
      containerCode: "A1",
      itemName: "USB Cable",
      itemAliases: "",
      tags: "electronics",
      quantity: 2,
      note: "",
    },
  ],
};

describe("api/import/commit POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/import/commit", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when household is not in memberships", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(getActiveMembershipContext).mockResolvedValue({
      memberships: [{ household: { id: "other-id" } }],
      active: { household: { id: "other-id" } },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/import/commit", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 403 when write access check fails", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(getActiveMembershipContext).mockResolvedValue({
      memberships: [{ household: { id: householdId } }],
      active: { household: { id: householdId } },
    } as never);
    vi.mocked(requireHouseholdWriteAccess).mockRejectedValue(
      new Error("Forbidden"),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/import/commit", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("commits csv when authorized", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(getActiveMembershipContext).mockResolvedValue({
      memberships: [{ household: { id: householdId } }],
      active: { household: { id: householdId } },
    } as never);
    vi.mocked(requireHouseholdWriteAccess).mockResolvedValue({} as never);
    vi.mocked(commitInventoryCsv).mockResolvedValue({
      importedRows: 1,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/import/commit", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      result: { importedRows: 1 },
    });
    expect(commitInventoryCsv).toHaveBeenCalledWith({
      userId: "u1",
      householdId,
      rows: body.rows,
    });
  });
});
