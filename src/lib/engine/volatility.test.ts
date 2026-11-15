import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { conviction, ewmaVolatility } from "./volatility";

function barsFromCloses(closes: number[]): Bar[] {
  return closes.map((close, index) => ({
    time: index * 60_000,
    open: index === 0 ? close : closes[index - 1],
    high: close * 1.001,
    low: close * 0.999,
    close,
    volume: 1,
  }));
}

describe("volatility scaling", () => {
  it("shrinks size when realized vol is above the target", () => {
    expect(conviction(0.8, 0.02, 0.01)).toBeCloseTo(0.4, 6);
    expect(conviction(0.8, 0.005, 0.01)).toBe(1);
  });

  it("raises volatility estimates when the bars get wider", () => {
    const calm = ewmaVolatility(barsFromCloses(Array.from({ length: 40 }, () => 100)));
    const wildCloses = Array.from({ length: 40 }, (_, index) => 100 + (index % 2 === 0 ? 2 : -2));
    const wild = ewmaVolatility(barsFromCloses(wildCloses));
    expect(wild.at(-1) ?? 0).toBeGreaterThan(calm.at(-1) ?? 0);
  });
});
