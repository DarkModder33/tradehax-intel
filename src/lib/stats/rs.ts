function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

/** Relative strength versus a benchmark, scaled so a match sits near 100. Not a trademarked rotation graph. */
export function relativeStrength(symbol: number[], benchmark: number[], period = 10): { ratio: number; momentum: number } | null {
  const n = Math.min(symbol.length, benchmark.length);
  if (n < period + 2) return null;
  const ratios: number[] = [];
  for (let index = 0; index < n; index += 1) {
    if (benchmark[index] <= 0) return null;
    ratios.push(symbol[index] / benchmark[index]);
  }
  const smooth = sma(ratios, period);
  if (smooth == null || smooth === 0) return null;
  const ratio = (100 * ratios[ratios.length - 1]) / smooth;
  const trail: number[] = [];
  for (let index = period; index <= ratios.length; index += 1) {
    const window = sma(ratios.slice(0, index), period);
    if (window) trail.push((100 * ratios[index - 1]) / window);
  }
  const momentumBase = sma(trail, Math.min(period, trail.length));
  if (momentumBase == null || momentumBase === 0) return { ratio, momentum: 100 };
  return { ratio, momentum: (100 * trail[trail.length - 1]) / momentumBase };
}
