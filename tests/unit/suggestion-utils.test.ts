import { describe, expect, it } from "vitest";

import {
  normalizeSuggestionQuantity,
  shouldMergeSuggestionWithExisting,
} from "@/lib/inventory/suggestion-utils";

describe("suggestion acceptance logic", () => {
  it("merges only above threshold", () => {
    expect(shouldMergeSuggestionWithExisting(0.81)).toBe(true);
    expect(shouldMergeSuggestionWithExisting(0.78)).toBe(true);
    expect(shouldMergeSuggestionWithExisting(0.7)).toBe(false);
  });

  it("normalizes suggestion quantity", () => {
    expect(normalizeSuggestionQuantity(4.9)).toBe(4);
    expect(normalizeSuggestionQuantity(undefined)).toBe(1);
    expect(normalizeSuggestionQuantity(0)).toBe(1);
  });
});
