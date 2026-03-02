const SPLIT_REGEX = /[\n,;]+/g;
const LEADING_QTY_REGEX = /^\s*(\d{1,6})(?:\s*x|\s*st|\s*pcs|\s*pack|x)?\s+(.+)$/i;

export type QuickAddEntry = {
  name: string;
  quantity: number;
};

function normalizeItemName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/g, "")
    .trim();
}

export function parseQuickAddText(input: string): QuickAddEntry[] {
  const segments = input
    .split(SPLIT_REGEX)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const entries: QuickAddEntry[] = [];
  for (const segment of segments) {
    const match = segment.match(LEADING_QTY_REGEX);
    if (match) {
      const qty = Number.parseInt(match[1] || "", 10);
      const name = normalizeItemName(match[2] || "");
      if (Number.isFinite(qty) && qty > 0 && name) {
        entries.push({ name, quantity: qty });
      }
      continue;
    }

    const fallbackName = normalizeItemName(segment);
    if (fallbackName) {
      entries.push({ name: fallbackName, quantity: 1 });
    }
  }

  return entries;
}

