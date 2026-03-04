import Papa from "papaparse";

export type InventoryCsvRow = {
  location: string;
  room: string;
  containerPath: string;
  containerCode: string;
  itemName: string;
  itemAliases: string;
  tags: string;
  quantity: number;
  note: string;
};

export type ImportDryRun = {
  validRows: InventoryCsvRow[];
  errors: Array<{ row: number; message: string }>;
  stats: {
    rows: number;
    uniqueLocations: number;
    uniqueRooms: number;
    uniqueContainers: number;
    uniqueItems: number;
  };
};

export const REQUIRED_COLUMNS = [
  "location",
  "room",
  "containerPath",
  "containerCode",
  "itemName",
  "itemAliases",
  "tags",
  "quantity",
  "note",
] as const;

function normalizeName(value: string) {
  return value.trim();
}

export function parsePipeList(value: string) {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function sanitizeCsvCellForSpreadsheet(value: string) {
  const trimmedStart = value.trimStart();
  const first = trimmedStart.charAt(0);
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    return `'${value}`;
  }
  return value;
}

export function exportRowsToCsv(rows: InventoryCsvRow[]) {
  const safeRows = rows.map((row) => ({
    ...row,
    location: sanitizeCsvCellForSpreadsheet(row.location),
    room: sanitizeCsvCellForSpreadsheet(row.room),
    containerPath: sanitizeCsvCellForSpreadsheet(row.containerPath),
    containerCode: sanitizeCsvCellForSpreadsheet(row.containerCode),
    itemName: sanitizeCsvCellForSpreadsheet(row.itemName),
    itemAliases: sanitizeCsvCellForSpreadsheet(row.itemAliases),
    tags: sanitizeCsvCellForSpreadsheet(row.tags),
    note: sanitizeCsvCellForSpreadsheet(row.note),
  }));

  return Papa.unparse(safeRows, {
    columns: [...REQUIRED_COLUMNS],
    skipEmptyLines: true,
  });
}

export function parseInventoryCsv(text: string): ImportDryRun {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const errors: Array<{ row: number; message: string }> = [];
  const validRows: InventoryCsvRow[] = [];

  if (parsed.errors.length) {
    parsed.errors.forEach((err) => {
      errors.push({
        row: (err.row ?? 0) + 1,
        message: err.message,
      });
    });
  }

  const headers = Object.keys(parsed.data[0] || {});
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) {
    errors.push({
      row: 1,
      message: `Missing required columns: ${missing.join(", ")}`,
    });
    return {
      validRows,
      errors,
      stats: {
        rows: 0,
        uniqueLocations: 0,
        uniqueRooms: 0,
        uniqueContainers: 0,
        uniqueItems: 0,
      },
    };
  }

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const location = normalizeName(raw.location || "");
    const room = normalizeName(raw.room || "");
    const containerPath = normalizeName(raw.containerPath || "");
    const containerCode = normalizeName(raw.containerCode || "");
    const itemName = normalizeName(raw.itemName || "");
    const itemAliases = normalizeName(raw.itemAliases || "");
    const tags = normalizeName(raw.tags || "");
    const note = normalizeName(raw.note || "");
    const quantityRaw = normalizeName(raw.quantity || "0");
    const quantity = Number.parseInt(quantityRaw, 10);

    if (!location) errors.push({ row: rowNumber, message: "location is required" });
    if (!room) errors.push({ row: rowNumber, message: "room is required" });
    if (!containerPath)
      errors.push({ row: rowNumber, message: "containerPath is required" });
    if (!itemName) errors.push({ row: rowNumber, message: "itemName is required" });
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.push({ row: rowNumber, message: "quantity must be >= 1" });
    }

    if (
      location &&
      room &&
      containerPath &&
      itemName &&
      Number.isInteger(quantity) &&
      quantity >= 1
    ) {
      validRows.push({
        location,
        room,
        containerPath,
        containerCode,
        itemName,
        itemAliases,
        tags,
        quantity,
        note,
      });
    }
  });

  const uniqueLocations = new Set(validRows.map((r) => r.location)).size;
  const uniqueRooms = new Set(validRows.map((r) => `${r.location}::${r.room}`)).size;
  const uniqueContainers = new Set(
    validRows.map((r) => `${r.location}::${r.room}::${r.containerPath}`),
  ).size;
  const uniqueItems = new Set(validRows.map((r) => r.itemName)).size;

  return {
    validRows,
    errors,
    stats: {
      rows: validRows.length,
      uniqueLocations,
      uniqueRooms,
      uniqueContainers,
      uniqueItems,
    },
  };
}
