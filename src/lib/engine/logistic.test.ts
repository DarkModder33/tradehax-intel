import { describe, expect, it } from "vitest";
import { compareModels, fitLogistic, predictLogistic, type Sample } from "./logistic";

describe("fitLogistic", () => {
  it("separates a feature that actually points at the label", () => {
    const rows: number[][] = [];
    const labels: number[] = [];
    for (let index = 0; index < 80; index += 1) {
      const signal = index % 2 === 0 ? 1 : -1;
      rows.push([signal, (index % 5) * 0.01]);
      labels.push(signal > 0 ? 1 : 0);
    }
    const model = fitLogistic(rows, labels, 0.1);
    const predicted = predictLogistic([[1, 0], [-1, 0]], model);
    expect(predicted[0]).toBeGreaterThan(0.7);
    expect(predicted[1]).toBeLessThan(0.3);
  });
});

describe("compareModels", () => {
  it("adopts a model that sees the label and rejects one that only sees noise", () => {
    const useful: Sample[] = [];
    const noise: Sample[] = [];
    for (let index = 0; index < 160; index += 1) {
      const bit = index % 2 === 0 ? 1 : 0;
      useful.push({ x: [bit === 1 ? 2 : -2, 0], y: bit, legacy: 0 });
      noise.push({ x: [(index % 7) - 3, (index % 3) - 1], y: bit, legacy: bit });
    }
    const adopted = compareModels(useful, 2);
    const rejected = compareModels(noise, 2);
    expect(adopted.adopted).toBe(true);
    expect(rejected.adopted).toBe(false);
    expect(adopted.modelLogLoss ?? 1).toBeLessThan(adopted.baseLogLoss ?? 0);
  });
});
