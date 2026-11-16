import { sma } from "./sma";

export interface BollingerPoint {
  middle: number | null;
  upper: number | null;
  lower: number | null;
}

/** Middle is an SMA. Bands use the population standard deviation, the ta-lib default. */
export function bollinger(values: number[], period = 20, mult = 2): BollingerPoint[] {
  const middle = sma(values, period);
  return values.map((_, index) => {
    const mid = middle[index];
    if (mid == null) return { middle: null, upper: null, lower: null };
    let sum = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const delta = values[cursor] - mid;
      sum += delta * delta;
    }
    const deviation = Math.sqrt(sum / period);
    return { middle: mid, upper: mid + mult * deviation, lower: mid - mult * deviation };
  });
}
