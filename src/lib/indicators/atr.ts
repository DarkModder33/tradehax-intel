import type { Bar } from "./types";

export function trueRange(bars: Bar[]): Array<number | null> {
  return bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    const previous = bars[index - 1].close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previous), Math.abs(bar.low - previous));
  });
}

/** Wilder ATR. The first value is the simple average of the first `period` true ranges. */
export function atr(bars: Bar[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(bars.length).fill(null);
  const ranges = trueRange(bars);
  if (period <= 0 || ranges.length < period) return out;
  let sum = 0;
  for (let index = 0; index < period; index += 1) sum += ranges[index] ?? 0;
  let previous = sum / period;
  out[period - 1] = previous;
  for (let index = period; index < ranges.length; index += 1) {
    previous = (previous * (period - 1) + (ranges[index] ?? 0)) / period;
    out[index] = previous;
  }
  return out;
}
