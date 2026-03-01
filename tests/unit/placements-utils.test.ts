import { describe, expect, it } from "vitest";

import { clampToRange, normalizePlacement } from "@/lib/inventory/placements-utils";

describe("placements constraints", () => {
  it("clamps values to range", () => {
    expect(clampToRange(-10, 0, 100)).toBe(0);
    expect(clampToRange(150, 0, 100)).toBe(100);
    expect(clampToRange(52, 0, 100)).toBe(52);
  });

  it("normalizes placement coordinates within layout bounds", () => {
    const placement = normalizePlacement({
      x: 19.6,
      y: -2,
      width: 12,
      height: 8,
    });

    expect(placement.x).toBe(12);
    expect(placement.y).toBe(0);
  });
});
