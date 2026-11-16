import { wilson } from "@/lib/stats/intervals";
import type { FlowPrint } from "./classify.ts";

export interface ForwardResult {
  n: number;
  hits: number;
  average: number;
  wilsonLo: number;
  wilsonHi: number;
}

/** Forward close-to-close return after a print, in the direction of the print's sentiment. */
export function flowForward(
  prints: FlowPrint[],
  closes: { date: string; close: number }[],
  horizon: number,
): ForwardResult {
  const byDate = new Map(closes.map((point) => [point.date, point.close]));
  const dates = closes.map((point) => point.date);
  const returns: number[] = [];
  for (const print of prints) {
    if (print.sentiment === "neutral") continue;
    const day = print.time.slice(0, 10);
    const index = dates.indexOf(day);
    if (index < 0 || index + horizon >= dates.length) continue;
    const start = byDate.get(dates[index]);
    const end = byDate.get(dates[index + horizon]);
    if (start == null || end == null || start === 0) continue;
    const raw = end / start - 1;
    returns.push(print.sentiment === "bullish" ? raw : -raw);
  }
  const hits = returns.filter((value) => value > 0).length;
  const interval = wilson(hits, returns.length);
  const average = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  return { n: returns.length, hits, average, wilsonLo: interval.lo, wilsonHi: interval.hi };
}
