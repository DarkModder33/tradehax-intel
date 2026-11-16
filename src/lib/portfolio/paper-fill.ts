import type { Bar } from "@/lib/indicators/types";

export interface LimitFill {
  filled: boolean;
  price: number | null;
  index: number | null;
  label: "simulated, 15-min-delayed data";
}

/** Market fills pay the spread in basis points. Buys lift, sells hit. */
export function marketFill(last: number, bps: number, side: 1 | -1): number {
  return last * (1 + (side * bps) / 10_000);
}

/** A buy limit fills when a later bar trades at or below it. A sell limit fills at or above it. */
export function limitFill(bars: Bar[], limit: number, side: 1 | -1): LimitFill {
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const hit = side === 1 ? bar.low <= limit : bar.high >= limit;
    if (hit) return { filled: true, price: limit, index, label: "simulated, 15-min-delayed data" };
  }
  return { filled: false, price: null, index: null, label: "simulated, 15-min-delayed data" };
}
