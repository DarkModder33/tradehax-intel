import { atr } from "@/lib/indicators/atr";
import { rsi } from "@/lib/indicators/rsi";
import { sma } from "@/lib/indicators/sma";
import type { Bar } from "@/lib/indicators/types";

export interface Technicals {
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  pctFrom52wHigh: number | null;
  atrPct: number | null;
  rvol20: number | null;
  ret5d: number | null;
  ret1m: number | null;
  ret3m: number | null;
}

function last(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] != null) return values[index];
  }
  return null;
}

function ret(closes: number[], barsBack: number): number | null {
  if (closes.length <= barsBack) return null;
  const then = closes[closes.length - 1 - barsBack];
  const now = closes[closes.length - 1];
  if (!(then > 0)) return null;
  return now / then - 1;
}

/** Daily-bar technicals. Missing history stays null. Nothing is filled with zero. */
export function technicalsFromBars(bars: Bar[]): Technicals {
  const closes = bars.map((bar) => bar.close);
  const rsi14 = last(rsi(closes, 14));
  const sma50 = last(sma(closes, 50));
  const sma200 = last(sma(closes, 200));
  const high = bars.slice(-252).reduce((max, bar) => Math.max(max, bar.high), 0);
  const close = closes.at(-1) ?? null;
  const atr14 = last(atr(bars, 14));
  const volumes = bars.map((bar) => bar.volume);
  const recent = volumes.at(-1);
  const base = volumes.slice(-21, -1);
  const avg = base.length >= 10 ? base.reduce((sum, value) => sum + value, 0) / base.length : null;
  return {
    rsi14,
    sma50,
    sma200,
    pctFrom52wHigh: close != null && high > 0 ? close / high - 1 : null,
    atrPct: atr14 != null && close ? atr14 / close : null,
    rvol20: recent != null && avg ? recent / avg : null,
    ret5d: ret(closes, 5),
    ret1m: ret(closes, 21),
    ret3m: ret(closes, 63),
  };
}
