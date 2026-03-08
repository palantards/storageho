import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/inventory/service", () => ({
  listMembershipsForUser: vi.fn(),
}));

import {
  requireHouseholdMembership,
  requireHouseholdWriteAccess,
} from "@/lib/inventory/guards";
import { listMembershipsForUser } from "@/lib/inventory/service";

const householdId = "550e8400-e29b-41d4-a716-446655440000";

describe("inventory guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns membership when user belongs to household", async () => {
    const membership = { role: "member" as const };
    vi.mocked(listMembershipsForUser).mockResolvedValue([
      {
        household: { id: householdId },
        membership,
      },
    ] as never);

    await expect(
      requireHouseholdMembership("user-1", householdId),
    ).resolves.toEqual(membership);
  });

  it("throws forbidden when user is not in household", async () => {
    vi.mocked(listMembershipsForUser).mockResolvedValue([] as never);

    await expect(
      requireHouseholdMembership("user-1", householdId),
    ).rejects.toThrow("Forbidden");
  });

  it("throws forbidden for viewer write attempts", async () => {
    vi.mocked(listMembershipsForUser).mockResolvedValue([
      {
        household: { id: householdId },
        membership: { role: "viewer" },
      },
    ] as never);

    await expect(
      requireHouseholdWriteAccess("user-1", householdId),
    ).rejects.toThrow("Forbidden");
  });

  it("allows write access for member role", async () => {
    const membership = { role: "member" as const };
    vi.mocked(listMembershipsForUser).mockResolvedValue([
      {
        household: { id: householdId },
        membership,
      },
    ] as never);

    await expect(
      requireHouseholdWriteAccess("user-1", householdId),
    ).resolves.toEqual(membership);
  });
});
