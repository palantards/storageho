export const DEFAULT_SUGGESTION_MERGE_THRESHOLD = 0.78;

export function shouldMergeSuggestionWithExisting(
  score: number,
  threshold = DEFAULT_SUGGESTION_MERGE_THRESHOLD,
) {
  if (!Number.isFinite(score)) return false;
  return score >= threshold;
}

export function normalizeSuggestionQuantity(value: number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.floor(numeric));
}

