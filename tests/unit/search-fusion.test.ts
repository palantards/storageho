import { describe, expect, it } from "vitest";

import {
  buildGroundedFindAnswer,
  fuseSearchResults,
} from "@/lib/inventory/search-fusion";

describe("search rank fusion", () => {
  it("combines fuzzy and semantic ranks", () => {
    const fused = fuseSearchResults({
      fuzzy: [
        {
          entityType: "item",
          entityId: "item-1",
          title: "HDMI Cable",
          subtitle: "Box A",
          href: "/items?item=item-1",
          score: 0.9,
          matchSource: "fuzzy",
          matchFields: ["name"],
        },
      ],
      semantic: [
        {
          entityType: "item",
          entityId: "item-1",
          title: "HDMI Cable",
          subtitle: "Box A",
          href: "/items?item=item-1",
          score: 0.7,
          matchSource: "semantic",
          matchFields: ["semantic"],
        },
        {
          entityType: "container",
          entityId: "box-1",
          title: "Electronics Box",
          subtitle: "Basement",
          href: "/boxes/box-1",
          score: 0.6,
          matchSource: "semantic",
          matchFields: ["semantic"],
        },
      ],
      limit: 10,
    });

    expect(fused[0]?.entityId).toBe("item-1");
    expect(fused[0]?.matchSource).toBe("hybrid");
  });

  it("builds grounded answer from fused results", () => {
    const answer = buildGroundedFindAnswer({
      query: "where is hdmi",
      results: [
        {
          entityType: "container",
          entityId: "box-1",
          title: "Electronics Box",
          subtitle: "Basement",
          href: "/boxes/box-1",
          score: 0.8,
          matchSource: "hybrid",
          matchFields: ["name", "semantic"],
        },
      ],
    });

    expect(answer?.bestMatch.title).toBe("Electronics Box");
    expect(answer?.confidence).toBeGreaterThan(0.5);
    expect(answer?.explanation).toContain("Best match");
  });
});
