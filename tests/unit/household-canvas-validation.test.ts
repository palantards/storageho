import { describe, expect, it } from "vitest";

import {
  createContainerFromSetupSchema,
  createRoomFromSetupSchema,
  householdFloorSchema,
  householdFloorUpdateSchema,
} from "@/lib/inventory/validation";

describe("household floor validation", () => {
  const householdId = "11111111-1111-4111-8111-111111111111";
  const floorId = "22222222-2222-4222-8222-222222222222";

  it("accepts new floor payload", () => {
    const parsed = householdFloorSchema.parse({
      householdId,
      name: "Main floor",
      sortOrder: 0,
    });
    expect(parsed.name).toBe("Main floor");
  });

  it("accepts floor update payload", () => {
    const parsed = householdFloorUpdateSchema.parse({
      householdId,
      floorId,
      name: "Renamed floor",
    });
    expect(parsed.floorId).toBe(floorId);
  });

  it("accepts setup room payload", () => {
    const parsed = createRoomFromSetupSchema.parse({
      householdId,
      floorId,
      name: "Storage zone",
    });
    expect(parsed.floorId).toBe(floorId);
  });

  it("accepts setup container payload with optional room", () => {
    const parsed = createContainerFromSetupSchema.parse({
      householdId,
      floorId,
      roomId: null,
      name: "Box 12",
      code: "B-12",
    });
    expect(parsed.roomId).toBeNull();
    expect(parsed.name).toBe("Box 12");
  });
});
