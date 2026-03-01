import { describe, expect, it } from "vitest";

import { parseQuickAddText } from "@/lib/inventory/quick-add";

describe("quick add parser", () => {
  it("parses qty + item names", () => {
    const parsed = parseQuickAddText("2 HDMI cables, 1 powerbank");
    expect(parsed).toEqual([
      { name: "HDMI cables", quantity: 2 },
      { name: "powerbank", quantity: 1 },
    ]);
  });

  it("defaults quantity to 1 when missing", () => {
    const parsed = parseQuickAddText("flashlight");
    expect(parsed).toEqual([{ name: "flashlight", quantity: 1 }]);
  });

  it("ignores empty segments", () => {
    const parsed = parseQuickAddText(" , , 3 batteries ; ");
    expect(parsed).toEqual([{ name: "batteries", quantity: 3 }]);
  });
});
