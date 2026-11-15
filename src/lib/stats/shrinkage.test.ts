import { describe, expect, it } from "vitest";
import { betaBinomialShrink } from "./shrinkage";

describe("betaBinomialShrink", () => {
  it("pulls a small sample toward the prior and leaves a large sample near its own rate", () => {
    const shrunk = betaBinomialShrink(18, 29, 0.5, 30);
    expect(shrunk).toBeCloseTo((18 + 15) / (29 + 30), 8);
    expect(shrunk).toBeLessThan(18 / 29);
    expect(betaBinomialShrink(500, 1000, 0.5, 30)).toBeCloseTo(0.5, 2);
  });
});
