import { describe, expect, it } from "vitest";
import { benjaminiHochberg, binomialUpperP } from "./multipleTesting";

describe("benjaminiHochberg", () => {
  it("rejects a single very small p-value and keeps the rest", () => {
    const flags = benjaminiHochberg([0.001, 0.4, 0.5, 0.8, 0.9], 0.1);
    expect(flags[0].reject).toBe(true);
    expect(flags.slice(1).every((item) => !item.reject)).toBe(true);
  });

  it("rejects nothing when every p-value is large", () => {
    const flags = benjaminiHochberg(Array.from({ length: 50 }, () => 0.5), 0.1);
    expect(flags.every((item) => !item.reject)).toBe(true);
  });

  it("keeps the survivor count low on uniform null p-values", () => {
    let survivors = 0;
    const trials = 20;
    for (let trial = 0; trial < trials; trial += 1) {
      const pValues = Array.from({ length: 100 }, (_, index) => ((index + 1) * (trial + 3) * 17) % 1000 / 1000);
      survivors += benjaminiHochberg(pValues, 0.1).filter((item) => item.reject).length;
    }
    expect(survivors / trials).toBeLessThan(15);
  });
});

describe("binomialUpperP", () => {
  it("is about 0.5 for the median of a fair coin and near 0 for a streak", () => {
    expect(binomialUpperP(5, 10, 0.5)).toBeGreaterThan(0.3);
    expect(binomialUpperP(5, 10, 0.5)).toBeLessThan(0.7);
    expect(binomialUpperP(20, 20, 0.5)).toBeLessThan(1e-5);
  });
});
