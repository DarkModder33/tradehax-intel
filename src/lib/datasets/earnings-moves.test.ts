import { describe, expect, it } from "vitest";
import { appendEarningsMoves, moveRatio, realizedFromCloses } from "./earnings-moves";

describe("earnings moves", () => {
  it("picks the BMO and AMC bars and dedupes a report", () => {
    expect(realizedFromCloses("bmo", 100, 110, 90)).toBeCloseTo(0.1);
    expect(realizedFromCloses("amc", 100, 110, 121)).toBeCloseTo(0.1);
    expect(realizedFromCloses("amc", 100, 110, null)).toBeNull();
    expect(moveRatio(0.05, 0.1)).toBeCloseTo(2);
    const once = appendEarningsMoves([], [{ sym: "NVDA", reportDate: "2026-11-19", timing: "amc", implied: 0.08, realized: null, spot: 100, beat: "unknown" }]);
    const twice = appendEarningsMoves(once, [{ sym: "NVDA", reportDate: "2026-11-19", timing: "amc", implied: null, realized: 0.04, spot: 100, beat: "beat" }]);
    expect(twice).toHaveLength(1);
    expect(twice[0].implied).toBe(0.08);
    expect(twice[0].realized).toBe(0.04);
  });
});
