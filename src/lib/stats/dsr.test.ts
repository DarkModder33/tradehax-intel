import { describe, expect, it } from "vitest";
import { deflatedSharpe } from "./dsr";

describe("deflatedSharpe", () => {
  it("stays modest for the best of many near-zero trial Sharpes", () => {
    const dsr = deflatedSharpe({
      sharpe: 0.15,
      trials: 100,
      sharpeVariance: 0.04,
      skew: 0,
      kurtosis: 3,
      observations: 80,
    });
    expect(dsr).toBeLessThan(0.6);
  });

  it("is higher for one trial with a large Sharpe than for the same Sharpe among 100 trials", () => {
    const single = deflatedSharpe({
      sharpe: 0.5,
      trials: 1,
      sharpeVariance: 0.01,
      skew: 0,
      kurtosis: 3,
      observations: 200,
    });
    const many = deflatedSharpe({
      sharpe: 0.5,
      trials: 100,
      sharpeVariance: 0.04,
      skew: 0,
      kurtosis: 3,
      observations: 200,
    });
    expect(single).toBeGreaterThan(many);
  });
});
