import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/inventory/service", () => ({
  getExportRows: vi.fn(),
}));

vi.mock("@/lib/inventory/csv", () => ({
  exportRowsToCsv: vi.fn(),
}));

import { GET } from "@/app/api/export/route";
import { getSession } from "@/lib/auth";
import { getExportRows } from "@/lib/inventory/service";
import { exportRowsToCsv } from "@/lib/inventory/csv";

describe("api/export GET", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/export?householdId=h1"),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 400 when householdId is missing", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });

    const response = await GET(new NextRequest("http://localhost/api/export"));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("householdId is required");
  });

  it("exports csv when valid", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", email: "u1@example.com" },
    });
    vi.mocked(getExportRows).mockResolvedValue([{ id: "r1" }] as never);
    vi.mocked(exportRowsToCsv).mockReturnValue("a,b\n1,2");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/export?householdId=550e8400-e29b-41d4-a716-446655440000&floorId=all",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(await response.text()).toBe("a,b\n1,2");
    expect(getExportRows).toHaveBeenCalledWith({
      userId: "u1",
      householdId: "550e8400-e29b-41d4-a716-446655440000",
      locationId: undefined,
    });
  });
});
