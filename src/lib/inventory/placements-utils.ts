export function clampToRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizePlacement(input: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const width = Math.max(1, Number(input.width));
  const height = Math.max(1, Number(input.height));
  return {
    x: Number(clampToRange(input.x, 0, width).toFixed(2)),
    y: Number(clampToRange(input.y, 0, height).toFixed(2)),
  };
}
