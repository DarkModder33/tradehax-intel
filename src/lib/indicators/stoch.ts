import type { Bar } from "./types";
import { sma } from "./sma";

export interface StochPoint {
  k: number | null;
  d: number | null;
}

/**
 * Stochastic. %K is the close location in the high-low range.
 * %D is an SMA of %K. A flat range returns 50.
 */
export function stoch(bars: Bar[], kPeriod = 14, dPeriod = 3): StochPoint[] {
  const raw: number[] = [];
  const points: StochPoint[] = bars.map((bar, index) => {
    if (index < kPeriod - 1) return { k: null, d: null };
    let high = -Infinity;
    let low = Infinity;
    for (let cursor = index - kPeriod + 1; cursor <= index; cursor += 1) {
      high = Math.max(high, bars[cursor].high);
      low = Math.min(low, bars[cursor].low);
    }
    const k = high === low ? 50 : ((bar.close - low) / (high - low)) * 100;
    raw.push(k);
    return { k, d: null };
  });
  const smoothed = sma(raw, dPeriod);
  let cursor = 0;
  for (const point of points) {
    if (point.k == null) continue;
    point.d = smoothed[cursor] ?? null;
    cursor += 1;
  }
  return points;
}
