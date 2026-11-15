/**
 * Exponential moving average. The seed is a simple average of the first
 * `period` values, then the standard 2/(period+1) smoothing takes over.
 * Entries before the seed are null.
 */
export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;

  let sum = 0;
  for (let index = 0; index < period; index += 1) sum += values[index];
  let previous = sum / period;
  out[period - 1] = previous;

  const k = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    previous = values[index] * k + previous * (1 - k);
    out[index] = previous;
  }
  return out;
}
