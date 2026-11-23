import { describe, expect, it } from "vitest";
import { heatAlpha, heatGrid, heatKey, sessionSlice, shortGex } from "./heat";

describe("gamma heatmap grid", () => {
  const cells = [
    { expiry: "2026-11-24", strike: 700, netGex: -2e9 },
    { expiry: "2026-11-24", strike: 710, netGex: 5e8 },
    { expiry: "2026-11-25", strike: 700, netGex: -1e9 },
    { expiry: "2026-11-25", strike: 705, netGex: 0 },
    { expiry: "2026-11-26", strike: 720, netGex: Number.NaN },
  ];
  it("orders strikes high to low, sums duplicates, drops empty and non-finite rows", () => {
    const grid = heatGrid([...cells, { expiry: "2026-11-24", strike: 700, netGex: -1e9 }], 703);
    expect(grid.strikes).toEqual([710, 700]);
    expect(grid.expiries).toEqual(["2026-11-24", "2026-11-25"]);
    expect(grid.values.get(heatKey("2026-11-24", 700))).toBe(-3e9);
    expect(grid.totals.get("700")).toBe(-4e9);
    expect(grid.spotStrike).toBe(700);
    expect(grid.max).toBe(3e9);
  });
  it("scales and labels cells", () => {
    expect(heatAlpha(0, 10)).toBe(0);
    expect(heatAlpha(10, 10)).toBeCloseTo(0.9);
    expect(heatAlpha(1, 0)).toBe(0);
    expect(shortGex(-2.04e9)).toBe("-2.0B");
    expect(shortGex(3.45e8)).toBe("345M");
    expect(shortGex(1.2e7)).toBe("12.0M");
    expect(shortGex(0)).toBe("");
  });
  it("keeps only the latest New York session", () => {
    const points = [{ time: "2026-11-20T20:59:00Z" }, { time: "2026-11-23T14:31:00Z" }, { time: "2026-11-23T20:00:00Z" }];
    expect(sessionSlice(points)).toHaveLength(2);
    expect(sessionSlice([])).toEqual([]);
  });
});
