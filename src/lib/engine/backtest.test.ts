import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import type { BarCall } from "@/lib/indicators/factors";
import { evaluateDirection, hysteresisPath, signedScore } from "./backtest";

function flatBars(count: number, drift = 0): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  for (let index = 0; index < count; index += 1) {
    const open = price;
    price = price * (1 + drift);
    bars.push({
      time: Date.UTC(2026, 0, 2) + index * 60_000,
      open,
      high: Math.max(open, price) * 1.001,
      low: Math.min(open, price) * 0.999,
      close: price,
      volume: 1_000,
    });
  }
  return bars;
}

describe("hysteresisPath", () => {
  it("enters only above 0.60 and stays until the score falls under 0.52", () => {
    const path = hysteresisPath([0.4, 0.7, 0.55, 0.5, -0.7, -0.55, -0.4]);
    expect(path).toEqual([0, 1, 1, 0, -1, -1, 0]);
  });
});

describe("evaluateDirection", () => {
  it("loses about two costs per trade when the signal is noise on a random walk", () => {
    const bars = flatBars(80, 0);
    // Alternate a known move that the signal does not see: scramble signs independently of the future open gap.
    const calls: BarCall[] = bars.map((_, index) => ({
      direction: index % 2 === 0 ? "bullish" : "bearish",
      probability: 80,
    }));
    // Zero-drift bars have zero open-to-open return, so net expectancy is exactly -2 * cost.
    const cell = evaluateDirection({
      symbol: "TEST",
      timeframe: "1d",
      direction: "bullish",
      bars,
      calls,
      horizon: 1,
      priorMean: 0.5,
    });
    expect(cell.n).toBeGreaterThan(0);
    expect(cell.netBps).not.toBeNull();
    expect(cell.netBps ?? 0).toBeCloseTo(-2 * cell.costBpsPerSide, 4);
  });

  it("does not improve when a look-ahead signal is delayed by one bar", () => {
    const bars = flatBars(60, 0).map((bar, index) => {
      const open = 100 + index;
      const close = open + (index % 2 === 0 ? 1 : -1);
      return { ...bar, open, high: Math.max(open, close) + 0.1, low: Math.min(open, close) - 0.1, close };
    });
    const aligned: BarCall[] = bars.map((bar, index) => {
      const nextOpen = bars[index + 2]?.open;
      const entry = bars[index + 1]?.open;
      const up = nextOpen != null && entry != null && nextOpen > entry;
      return { direction: up ? "bullish" : "bearish", probability: 90 };
    });
    const lagged: BarCall[] = [{ direction: "neutral", probability: 0 }, ...aligned.slice(0, -1)];
    const good = evaluateDirection({
      symbol: "SPY",
      timeframe: "1m",
      direction: "bullish",
      bars,
      calls: aligned,
      horizon: 1,
      priorMean: 0.5,
    });
    const late = evaluateDirection({
      symbol: "SPY",
      timeframe: "1m",
      direction: "bullish",
      bars,
      calls: lagged,
      horizon: 1,
      priorMean: 0.5,
    });
    expect(good.grossBps ?? 0).toBeGreaterThan(late.grossBps ?? 0);
  });
});

describe("signedScore", () => {
  it("points the legacy confidence in the call's direction", () => {
    expect(signedScore({ direction: "bearish", probability: 70 })).toBeCloseTo(-0.7, 6);
  });
});
