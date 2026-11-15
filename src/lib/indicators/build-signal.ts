import { buildFactors } from "./factors";
import { scoreFactors } from "./score";
import type { Bar, Signal, Timeframe } from "./types";

/** MACD 26/9 needs the mid-30s. Forty bars leaves a little room past warmup. */
export const MIN_BARS = 40;

export function buildSignal(symbol: string, timeframe: Timeframe, bars: Bar[]): Signal {
  const last = bars[bars.length - 1];
  const trail = bars.slice(-32).map((bar) => bar.close);
  if (bars.length < MIN_BARS || !last) {
    return {
      symbol,
      timeframe,
      direction: "neutral",
      probability: 0,
      net: 0,
      agreement: 0,
      summary: "Not enough price history on this timeframe to score it yet.",
      factors: [],
      price: last?.close ?? 0,
      asOf: last?.time ?? 0,
      barCount: bars.length,
      trail,
    };
  }

  const factors = buildFactors(bars, timeframe);
  const scored = scoreFactors(factors);
  return {
    symbol,
    timeframe,
    ...scored,
    factors,
    price: last.close,
    asOf: last.time,
    barCount: bars.length,
    trail,
  };
}
