/**
 * Axis ticks for count charts: whole numbers only, no repeats, starting at 0 and ending at or above
 * `max`, with a 1/2/5×10ⁿ step so there are at most about `target` + 1 labels.
 */
export function integerTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
