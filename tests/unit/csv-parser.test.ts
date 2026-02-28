import { describe, expect, it } from "vitest";

import { parseInventoryCsv } from "@/lib/inventory/csv-shared";

describe("parseInventoryCsv", () => {
  it("parses valid rows", () => {
    const csv = "location,room,containerPath,containerCode,itemName,itemAliases,tags,quantity,note\nApartment,Kitchen,Shelf 1,SH-1,Cup,mug|cup,kitchen|fragile,4,Top shelf";

    const result = parseInventoryCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].itemName).toBe("Cup");
    expect(result.validRows[0].quantity).toBe(4);
  });

  it("reports missing columns", () => {
    const csv = "location,room,itemName,quantity\nApartment,Kitchen,Cup,4";

    const result = parseInventoryCsv(csv);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0]?.message).toContain("Missing required columns");
  });

  it("reports invalid quantity", () => {
    const csv = "location,room,containerPath,containerCode,itemName,itemAliases,tags,quantity,note\nApartment,Kitchen,Shelf 1,SH-1,Cup,,,0,";

    const result = parseInventoryCsv(csv);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors.some((error) => error.message.includes("quantity"))).toBe(true);
  });
});