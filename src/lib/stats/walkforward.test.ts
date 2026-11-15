import { describe, expect, it } from "vitest";
import { walkForwardFolds } from "./walkforward";

describe("walkForwardFolds", () => {
  it("keeps train indices strictly before the test block and drops the embargo overlap", () => {
    const folds = walkForwardFolds(120, { horizon: 4, minTrain: 40, testSize: 20, embargo: 4 });
    expect(folds.length).toBeGreaterThan(0);
    for (const fold of folds) {
      const testStart = fold.test[0];
      const testEnd = fold.test[fold.test.length - 1];
      expect(Math.max(...fold.train)).toBeLessThan(testStart);
      expect(fold.train.some((index) => index + 4 >= testStart && index <= testEnd + 4)).toBe(false);
      expect(fold.test.every((index) => index >= testStart)).toBe(true);
    }
  });
});
