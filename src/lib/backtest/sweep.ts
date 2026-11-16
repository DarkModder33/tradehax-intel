import type { Bar } from "@/lib/indicators/types";
import { metricsOf } from "./metrics";
import { simulate } from "./simulate";
import type { StrategySpec } from "./rules";

export interface SweepCell {
  a: number;
  b: number | null;
  sharpe: number;
}

export function countTrials(a: number[], b: number[] | null): number {
  return a.length * (b?.length || 1);
}

/** One or two numeric parameters. The caller patches them onto a copy of the spec. */
export function sweepSharpe(
  bars: Bar[],
  base: StrategySpec,
  apply: (spec: StrategySpec, a: number, b: number | null) => StrategySpec,
  aValues: number[],
  bValues: number[] | null,
  years: number,
): { cells: SweepCell[]; trials: number } {
  const cells: SweepCell[] = [];
  const buyHold = bars.length > 1 && bars[0].close > 0 ? bars[bars.length - 1].close / bars[0].close - 1 : 0;
  const seconds = bValues?.length ? bValues : [null];
  for (const a of aValues) {
    for (const b of seconds) {
      const spec = apply(structuredClone(base), a, b);
      const result = simulate(bars, spec);
      const stats = metricsOf(result.equity, result.trades, bars.length, years, buyHold);
      cells.push({ a, b, sharpe: stats.sharpe });
    }
  }
  return { cells, trials: countTrials(aValues, bValues) };
}
