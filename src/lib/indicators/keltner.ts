import { atr } from "./atr";
import { ema } from "./ema";
import type { Bar } from "./types";

export interface KeltnerPoint {
  middle: number | null;
  upper: number | null;
  lower: number | null;
}

/** EMA middle with Wilder ATR bands. */
export function keltner(bars: Bar[], period = 20, mult = 2): KeltnerPoint[] {
  const middle = ema(bars.map((bar) => bar.close), period);
  const width = atr(bars, period);
  return bars.map((_, index) => {
    const mid = middle[index];
    const band = width[index];
    if (mid == null || band == null) return { middle: null, upper: null, lower: null };
    return { middle: mid, upper: mid + mult * band, lower: mid - mult * band };
  });
}
