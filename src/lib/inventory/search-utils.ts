export function normalizeSearchQuery(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export type RankedResult<T> = T & { score: number };

export function rankSearchResults<T>(rows: RankedResult<T>[]) {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return 0;
  });
}