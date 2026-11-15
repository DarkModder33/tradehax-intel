import { describe, expect, it } from "vitest";
import { buildSignal } from "./build-signal";
import { ema } from "./ema";
import { buildFactors, VOTE_THRESHOLD } from "./factors";
import { macd } from "./macd";
import { rsi } from "./rsi";
import type { Bar } from "./types";
import { sessionVwap, trailingVwap } from "./vwap";
import { volumeRatio } from "./volume";

function barsFromCloses(closes: number[], volume = 1_000): Bar[] {
  const start = Date.UTC(2026, 10, 13, 14, 30, 0);
  return closes.map((close, index) => {
    const open = index === 0 ? close : closes[index - 1];
    return {
      time: start + index * 60_000,
      open,
      high: Math.max(open, close) + 0.05,
      low: Math.max(0.01, Math.min(open, close) - 0.05),
      close,
      volume,
    };
  });
}

describe("ema", () => {
  it("seeds with a simple average and then smooths", () => {
    const series = ema([10, 10, 10, 14], 3);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBe(10);
    expect(series[3]).toBe(12);
  });
});

describe("rsi", () => {
  it("follows Wilder smoothing on a short series", () => {
    const series = rsi([10, 11, 12, 11, 10, 11], 3);
    expect(series[3]).toBeCloseTo(66.666, 2);
    expect(series[4]).toBeCloseTo(44.444, 2);
    expect(series[5]).toBeCloseTo(62.963, 2);
  });

  it("saturates when every bar is a gain or every bar is a loss", () => {
    const up = Array.from({ length: 30 }, (_, index) => 50 + index);
    const down = Array.from({ length: 30 }, (_, index) => 80 - index);
    expect(rsi(up, 14).at(-1)).toBeGreaterThan(90);
    expect(rsi(down, 14).at(-1)).toBeLessThan(10);
  });

  it("stays at 50 when price does not move", () => {
    expect(rsi(Array.from({ length: 20 }, () => 25), 14).at(-1)).toBe(50);
  });
});

describe("macd", () => {
  it("is flat on a flat price and positive after a late surge", () => {
    const flat = macd(Array.from({ length: 80 }, () => 10));
    expect(flat.at(-1)?.histogram).toBeCloseTo(0, 8);

    const surge = macd([
      ...Array.from({ length: 50 }, () => 10),
      ...Array.from({ length: 15 }, (_, index) => 10 + (index + 1) * 0.5),
    ]);
    expect(surge.at(-1)?.histogram ?? 0).toBeGreaterThan(0);
  });
});

describe("vwap and volume", () => {
  it("computes session VWAP from typical price", () => {
    const bars: Bar[] = [
      { time: Date.UTC(2026, 10, 13, 14, 30), open: 10, high: 10, low: 10, close: 10, volume: 100 },
      { time: Date.UTC(2026, 10, 13, 14, 31), open: 10, high: 12, low: 10, close: 11, volume: 100 },
    ];
    expect(sessionVwap(bars, "2026-11-13")).toBeCloseTo(10.5, 6);
    expect(trailingVwap(bars, 20)).toBeCloseTo(10.5, 6);
  });

  it("compares the latest volume with the prior average", () => {
    const volumes = [...Array.from({ length: 20 }, () => 100), 250];
    expect(volumeRatio(volumes, 20)).toBeCloseTo(2.5, 6);
  });
});

describe("buildSignal", () => {
  it("refuses to score a short history", () => {
    const signal = buildSignal("TEST", "5m", barsFromCloses([10, 11, 12]));
    expect(signal.direction).toBe("neutral");
    expect(signal.probability).toBe(0);
    expect(signal.summary).toMatch(/not enough price history/i);
    expect(signal.factors).toHaveLength(0);
  });

  it("names a stretched RSI against a rising trend, and confirms the push with volume", () => {
    const closes = Array.from({ length: 80 }, (_, index) => 100 + index * 0.15);
    const bars = barsFromCloses(closes).map((bar, index, all) =>
      index === all.length - 1 ? { ...bar, volume: 4_000 } : bar,
    );
    const signal = buildSignal("TEST", "5m", bars);
    const byId = Object.fromEntries(signal.factors.map((factor) => [factor.id, factor]));

    expect(signal.factors.map((factor) => factor.id)).toEqual([
      "ema",
      "macd",
      "rsi",
      "vwap",
      "volume",
    ]);
    expect(byId.ema.direction).toBe("bullish");
    expect(byId.rsi.direction).toBe("bearish");
    expect(byId.rsi.detail).toMatch(/overbought/i);
    expect(byId.volume.direction).toBe("bullish");
    expect(byId.vwap.direction).toBe("bullish");
    expect(signal.summary.length).toBeGreaterThan(20);

    for (const factor of signal.factors) {
      if (factor.direction === "bullish") expect(factor.score).toBeGreaterThanOrEqual(VOTE_THRESHOLD);
      if (factor.direction === "bearish") expect(factor.score).toBeLessThanOrEqual(-VOTE_THRESHOLD);
      if (factor.direction === "neutral") expect(Math.abs(factor.score)).toBeLessThan(VOTE_THRESHOLD);
    }
  });

  it("reads a falling EMA stack as bearish", () => {
    const closes = Array.from({ length: 80 }, (_, index) => 200 - index * 0.2);
    const factors = buildFactors(barsFromCloses(closes), "15m");
    expect(factors.find((factor) => factor.id === "ema")?.direction).toBe("bearish");
  });
});
