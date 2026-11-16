import type { Bar } from "./types";

/** On-balance volume. The first bar is zero. Later bars add or subtract volume with the close. */
export function obv(bars: Bar[]): number[] {
  const out: number[] = [];
  let total = 0;
  for (let index = 0; index < bars.length; index += 1) {
    if (index > 0) {
      const change = bars[index].close - bars[index - 1].close;
      if (change > 0) total += bars[index].volume;
      else if (change < 0) total -= bars[index].volume;
    }
    out.push(total);
  }
  return out;
}
