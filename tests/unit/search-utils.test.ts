import { describe, expect, it } from "vitest";

import {
  normalizeSearchQuery,
  rankSearchResults,
} from "@/lib/inventory/search-utils";

describe("search utils", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeSearchQuery("   WiNter   BOX   ")).toBe("winter box");
  });

  it("ranks by descending score", () => {
    const ranked = rankSearchResults([
      { id: "a", score: 0.2 },
      { id: "b", score: 0.9 },
      { id: "c", score: 0.5 },
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });
});