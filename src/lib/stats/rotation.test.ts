import { describe, expect, it } from "vitest";
import { correlationMatrix, pearson } from "./correlation";
import { relativeStrength } from "./rs";

describe("rotation math", () => {
  it("returns a symmetric correlation with ones on the diagonal", () => {
    const a = [0.01, -0.02, 0.03, 0.01, -0.01];
    const b = [0.02, -0.01, 0.04, 0, -0.02];
    expect(pearson(a, a)).toBeCloseTo(1, 6);
    const matrix = correlationMatrix([a, b]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 8);
  });

  it("centers relative strength near 100 when the series match", () => {
    const closes = Array.from({ length: 40 }, (_, index) => 100 + index);
    const point = relativeStrength(closes, closes, 10);
    expect(point?.ratio).toBeCloseTo(100, 4);
    expect(point?.momentum).toBeCloseTo(100, 4);
  });
});
