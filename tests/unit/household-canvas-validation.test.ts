import { describe, expect, it } from "vitest";

import {
  householdCanvasCreateRoomSchema,
  householdCanvasPlacementSchema,
} from "@/lib/inventory/validation";

describe("household canvas validation", () => {
  const householdId = "11111111-1111-4111-8111-111111111111";
  const layerId = "22222222-2222-4222-8222-222222222222";
  const entityId = "33333333-3333-4333-8333-333333333333";

  it("allows room placement shapes", () => {
    const parsed = householdCanvasPlacementSchema.parse({
      householdId,
      layerId,
      entityType: "room",
      entityId,
      x: 1,
      y: 1,
      width: 4,
      height: 3,
      shapeType: "triangle",
    });
    expect(parsed.shapeType).toBe("triangle");
  });

  it("rejects non-rectangle container shape", () => {
    const result = householdCanvasPlacementSchema.safeParse({
      householdId,
      layerId,
      entityType: "container",
      entityId,
      x: 1,
      y: 1,
      width: 4,
      height: 3,
      shapeType: "triangle",
    });
    expect(result.success).toBe(false);
  });

  it("accepts new room payload with square shape type", () => {
    const parsed = householdCanvasCreateRoomSchema.parse({
      householdId,
      layerId,
      name: "Storage zone",
      x: 2,
      y: 2,
      width: 5,
      height: 5,
      shapeType: "square",
    });
    expect(parsed.shapeType).toBe("square");
  });
});
