import { describe, expect, it } from "vitest";
import { betaQuantile, jeffreysInterval, regularizedIncompleteBeta, wilson } from "./intervals";

describe("wilson", () => {
  it("matches the 18/29 interval used as the acceptance check", () => {
    const interval = wilson(18, 29);
    expect(interval.p).toBeCloseTo(18 / 29, 8);
    expect(interval.lo).toBeCloseTo(0.44, 2);
    expect(interval.hi).toBeCloseTo(0.773, 2);
  });

  it("is empty-safe", () => {
    expect(wilson(0, 0)).toEqual({ p: 0, lo: 0, hi: 1 });
  });
});

describe("beta helpers", () => {
  it("puts half the Uniform(0,1) mass at 1/2", () => {
    expect(regularizedIncompleteBeta(0.5, 1, 1)).toBeCloseTo(0.5, 5);
    expect(betaQuantile(0.5, 1, 1)).toBeCloseTo(0.5, 4);
  });

  it("returns a Jeffreys interval inside (0, 1) for 18/29", () => {
    const interval = jeffreysInterval(18, 29);
    expect(interval.lo).toBeGreaterThan(0.3);
    expect(interval.lo).toBeLessThan(0.55);
    expect(interval.hi).toBeGreaterThan(0.7);
    expect(interval.hi).toBeLessThan(0.9);
  });
});
