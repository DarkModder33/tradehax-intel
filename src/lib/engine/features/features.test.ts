import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { buyFraction, bvcImbalance } from "./bvc";
import { gapSplit } from "./gap";
import { intradayMomentum, openingRange } from "./intraday";

function bar(time: number, open: number, close: number, volume = 100): Bar {
  return { time, open, high: Math.max(open, close), low: Math.min(open, close), close, volume };
}

describe("bvc", () => {
  it("calls an up bar mostly buying and a down bar mostly selling", () => {
    expect(buyFraction(1, 1)).toBeGreaterThan(0.8);
    expect(buyFraction(-1, 1)).toBeLessThan(0.2);
    const bars = [bar(0, 10, 10), bar(1, 10, 11, 50), bar(2, 11, 12, 50)];
    expect(bvcImbalance(bars, 2, 2)).toBeGreaterThan(0);
  });
});

describe("gapSplit", () => {
  it("separates the overnight gap from the open-to-close move", () => {
    const bars = [bar(0, 100, 100), bar(1, 110, 105)];
    const split = gapSplit(bars);
    expect(split?.overnight).toBeCloseTo(0.1, 6);
    expect(split?.intraday).toBeCloseTo(105 / 110 - 1, 6);
  });
});

describe("intraday features", () => {
  it("reads the first half hour in New York time", () => {
    // 14:30 UTC is 9:30 ET in November.
    const start = Date.UTC(2026, 10, 13, 14, 30, 0);
    const bars = [
      bar(start, 100, 101),
      bar(start + 30 * 60_000, 101, 103),
      bar(start + 6 * 60 * 60_000, 103, 104),
    ];
    const momentum = intradayMomentum(bars);
    expect(momentum.firstHalfHour).toBeCloseTo(0.03, 6);
    expect(momentum.side).toBe("bullish");
  });

  it("stays neutral when the opening burst has no volume history", () => {
    const start = Date.UTC(2026, 10, 13, 14, 30, 0);
    const range = openingRange([bar(start, 100, 101, 500), bar(start + 10 * 60_000, 101, 102, 100)]);
    expect(range.direction).toBe("neutral");
    expect(range.detail).toMatch(/not enough|prior sessions/i);
  });
});
