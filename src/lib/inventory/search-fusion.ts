import type { GlobalSearchResult } from "@/lib/inventory/service";

const RRF_K = 60;

type MutableResult = GlobalSearchResult & {
  score: number;
  rawSources: Array<"fuzzy" | "semantic">;
};

export function fuseSearchResults(input: {
  fuzzy: GlobalSearchResult[];
  semantic: GlobalSearchResult[];
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));
  const merged = new Map<string, MutableResult>();

  const addSource = (
    rows: GlobalSearchResult[],
    source: "fuzzy" | "semantic",
  ) => {
    rows.forEach((row, index) => {
      const key = `${row.entityType}:${row.entityId}`;
      const rankScore = 1 / (RRF_K + index + 1);
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, {
          ...row,
          score: rankScore,
          rawSources: [source],
          matchSource: source,
          matchFields: [...(row.matchFields || [])],
        });
        return;
      }

      existing.score += rankScore;
      if (!existing.rawSources.includes(source)) {
        existing.rawSources.push(source);
      }
      const matchFields = new Set([
        ...(existing.matchFields || []),
        ...(row.matchFields || []),
      ]);
      existing.matchFields = [...matchFields];
      existing.matchSource =
        existing.rawSources.length > 1 ? "hybrid" : existing.rawSources[0];
      merged.set(key, existing);
    });
  };

  addSource(input.fuzzy, "fuzzy");
  addSource(input.semantic, "semantic");

  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      score: Number(row.score.toFixed(6)),
    }));
}

export function buildGroundedFindAnswer(input: {
  query: string;
  results: GlobalSearchResult[];
}) {
  const top = input.results[0];
  if (!top) {
    return null;
  }

  const confidence = Math.max(0.25, Math.min(0.99, top.score));
  const fields = top.matchFields?.length
    ? top.matchFields.join(", ")
    : top.matchSource || "search score";

  const showOnMapHref =
    top.entityType === "room"
      ? `/rooms/${top.entityId}/map`
      : top.entityType === "container"
        ? `/boxes/${top.entityId}`
        : undefined;

  return {
    bestMatch: {
      entityType: top.entityType,
      entityId: top.entityId,
      title: top.title,
      subtitle: top.subtitle,
      href: top.href,
      showOnMapHref,
    },
    confidence: Number(confidence.toFixed(2)),
    explanation: `Best match for \"${input.query}\" is \"${top.title}\" based on ${fields}.`,
  };
}
