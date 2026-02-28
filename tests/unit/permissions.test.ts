import { describe, expect, it } from "vitest";

import {
  canManageHousehold,
  canManageMembers,
  canWriteInventory,
  isOwner,
} from "@/lib/inventory/roles";

describe("role permissions", () => {
  it("viewer is read-only", () => {
    expect(canWriteInventory("viewer")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);
    expect(canManageHousehold("viewer")).toBe(false);
  });

  it("member can write inventory only", () => {
    expect(canWriteInventory("member")).toBe(true);
    expect(canManageMembers("member")).toBe(false);
    expect(canManageHousehold("member")).toBe(false);
  });

  it("admin can manage members and household", () => {
    expect(canWriteInventory("admin")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageHousehold("admin")).toBe(true);
    expect(isOwner("admin")).toBe(false);
  });

  it("owner is owner", () => {
    expect(canWriteInventory("owner")).toBe(true);
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageHousehold("owner")).toBe(true);
    expect(isOwner("owner")).toBe(true);
  });
});