import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { deflatedSharpe } from "@/lib/stats/dsr";
import { metricsOf } from "./metrics";
import { conditionTrue, decodeStrategy, encodeStrategy, smaCross, type Condition } from "./rules";
import { simulate } from "./simulate";
import { countTrials, sweepSharpe } from "./sweep";

function barsFrom(closes: number[], lows?: number[], highs?: number[]): Bar[] {
  return closes.map((close, index) => ({
    time: Date.UTC(2020, 0, index + 1),
    open: close,
    high: highs?.[index] ?? close,
    low: lows?.[index] ?? close,
    close,
    volume: 1,
  }));
}

describe("backtest lab", () => {
  it("fills on the next open and takes the stop before the target", () => {
    const series = barsFrom([10, 10, 10, 10], [10, 10, 8, 10], [10, 10, 13, 10]);
    const spec = smaCross();
    spec.entry = { join: "AND", conditions: [{ left: { name: "close" }, op: ">", right: 9 }] };
    spec.exit = { join: "AND", conditions: [] };
    spec.stopPct = 0.1;
    spec.targetPct = 0.2;
    const result = simulate(series, spec, { startingEquity: 1000 });
    expect(result.trades[0].entryIndex).toBe(1);
    expect(result.trades[0].reason).toBe("stop");
    expect(result.stopFirst).toBe(true);
    expect(result.trades[0].exit).toBeCloseTo(9, 6);
  });

  it("detects a crossover only on the bar it happens", () => {
    const series = barsFrom([1, 2, 3, 2, 4]);
    const cross: Condition = { left: { name: "close" }, op: "crosses above", right: 2.5 };
    const cache = new Map();
    expect(conditionTrue(series, 1, cross, cache)).toBe(false);
    expect(conditionTrue(series, 2, cross, cache)).toBe(true);
    expect(conditionTrue(series, 3, cross, cache)).toBe(false);
  });

  it("matches a hand-computed return, drawdown, and trial count", () => {
    const equity = [100, 110, 90, 99];
    const stats = metricsOf(equity, [{ side: 1, entryIndex: 0, exitIndex: 2, entry: 100, exit: 90, pnl: -10, reason: "end" }], 4, 1, 0);
    expect(stats.totalReturn).toBeCloseTo(-0.01, 8);
    expect(stats.maxDrawdown).toBeCloseTo(90 / 110 - 1, 8);
    expect(stats.cagr).toBeCloseTo(-0.01, 8);
    const spec = smaCross(2, 4);
    const sweep = sweepSharpe(barsFrom([1, 2, 3, 4, 5, 6, 7, 8]), spec, (next, fast) => ({ ...next, entry: next.entry, exit: next.exit, sizePct: next.sizePct }), [5, 10], [20], 1);
    expect(sweep.trials).toBe(countTrials([5, 10], [20]));
    const sharpes = sweep.cells.map((cell) => cell.sharpe);
    const dsr = deflatedSharpe({
      sharpe: sharpes[0] / Math.sqrt(252),
      trials: sweep.trials,
      sharpeVariance: 0.01,
      skew: 0,
      kurtosis: 3,
      observations: 8,
    });
    expect(dsr).toBeGreaterThanOrEqual(0);
    expect(dsr).toBeLessThanOrEqual(1);
    const encoded = encodeStrategy(spec);
    expect(decodeStrategy(encoded)?.entry.conditions[0].left).toMatchObject({ name: "sma", period: 2 });
  });
});
