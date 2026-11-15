import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { buildSignal } from "@/lib/indicators/build-signal";
import { replayDirections } from "@/lib/indicators/factors";
import {
  historyLabel,
  replaySignals,
  scoreOutcome,
  summarizeOutcomes,
  type CallOutcome,
  type ReplayReport,
} from "./backtest";

function outcome(
  direction: "bullish" | "bearish",
  rawReturn: number,
): CallOutcome {
  const calledReturn = direction === "bullish" ? rawReturn : -rawReturn;
  return { direction, rawReturn, calledReturn, hit: calledReturn > 0 };
}

describe("scoreOutcome", () => {
  it("counts a rise after a bullish call as a hit and a drop as a miss", () => {
    expect(scoreOutcome(100, 101, "bullish")).toMatchObject({ hit: true, calledReturn: 0.01 });
    expect(scoreOutcome(100, 99, "bullish")).toMatchObject({ hit: false, calledReturn: -0.01 });
  });

  it("counts a drop after a bearish call as a hit", () => {
    expect(scoreOutcome(100, 98, "bearish")).toMatchObject({ hit: true, rawReturn: -0.02, calledReturn: 0.02 });
  });

  it("rejects a flat or missing price", () => {
    expect(scoreOutcome(100, 100, "bullish")?.hit).toBe(false);
    expect(scoreOutcome(0, 10, "bullish")).toBeNull();
  });
});

describe("summarizeOutcomes", () => {
  it("reports hit rate, average called return, and sample size", () => {
    const stats = summarizeOutcomes(
      [outcome("bullish", 0.02), outcome("bullish", -0.01), outcome("bearish", -0.04)],
      "bullish",
    );
    expect(stats.sampleSize).toBe(2);
    expect(stats.hits).toBe(1);
    expect(stats.hitRate).toBe(0.5);
    expect(stats.averageCalledReturn).toBeCloseTo(0.005, 8);
  });

  it("returns an empty measurement when nothing qualifies", () => {
    const stats = summarizeOutcomes([], "all");
    expect(stats.hitRate).toBeNull();
    expect(stats.averageCalledReturn).toBeNull();
    expect(stats.sampleSize).toBe(0);
  });
});

describe("historyLabel", () => {
  const report: ReplayReport = {
    timeframe: "15m",
    horizon: 4,
    bullish: { direction: "bullish", sampleSize: 240, hits: 139, hitRate: 139 / 240, averageCalledReturn: 0.0018 },
    bearish: { direction: "bearish", sampleSize: 3, hits: 1, hitRate: 1 / 3, averageCalledReturn: -0.001 },
    all: { direction: "all", sampleSize: 243, hits: 140, hitRate: 140 / 243, averageCalledReturn: 0.001 },
  };

  it("quotes a large sample in plain language", () => {
    expect(historyLabel(report, "bullish")).toBe(
      "Historically right 58% of the time over 240 bullish signals. Average move in the called direction was +0.18% over the next 4 bars.",
    );
  });

  it("refuses a tiny sample and skips mixed calls", () => {
    expect(historyLabel(report, "bearish")).toMatch(/too few to quote a hit rate/);
    expect(historyLabel(report, "neutral")).toMatch(/left out/);
  });
});

describe("replaySignals", () => {
  it("scores a rising series and only uses bars that have a full forward window", () => {
    const start = Date.UTC(2026, 10, 13, 14, 30, 0);
    const bars: Bar[] = Array.from({ length: 70 }, (_, index) => {
      const close = 100 + index * 0.4;
      const open = index === 0 ? close : 100 + (index - 1) * 0.4;
      return {
        time: start + index * 60_000,
        open,
        high: Math.max(open, close) + 0.05,
        low: Math.min(open, close) - 0.05,
        close,
        volume: index % 7 === 0 ? 4_000 : 1_000,
      };
    });
    const report = replaySignals("TEST", "5m", bars);
    expect(report.horizon).toBe(6);
    expect(report.all.sampleSize).toBeGreaterThan(0);
    expect(report.all.sampleSize).toBeLessThanOrEqual(bars.length - 40 - 6 + 1);
    expect(report.all.hitRate).not.toBeNull();
    const directional = report.bullish.sampleSize + report.bearish.sampleSize;
    expect(directional).toBe(report.all.sampleSize);
    const directions = replayDirections(bars, "5m");
    expect(directions.at(-1)).toBe(buildSignal("TEST", "5m", bars).direction);
    expect(directions[50]).toBe(buildSignal("TEST", "5m", bars.slice(0, 51)).direction);
  });
});
