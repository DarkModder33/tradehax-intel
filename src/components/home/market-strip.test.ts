import { describe, expect, it } from "vitest";
import { stripRow } from "./market-strip";

describe("market strip", () => {
  it("measures the last close against the prior close", () => {
    const row = stripRow("SPY", [{ close: 715.87 }, { close: 689.81 }, { close: 722.29 }]);
    expect(row?.price).toBe(722.29);
    expect(row?.change).toBeCloseTo(4.71, 2);
  });
  it("refuses blank, zero, or single-bar input", () => {
    expect(stripRow("SPY", [])).toBeNull();
    expect(stripRow("SPY", [{ close: 0 }, { close: 700 }])).toBeNull();
    expect(stripRow("SPY", [{ close: null }, { close: "" }, { close: 700 }])).toBeNull();
  });
});
