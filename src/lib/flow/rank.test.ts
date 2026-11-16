import { describe, expect, it } from "vitest";
import { flowForward } from "./backtest";
import type { FlowPrint } from "./classify";
import { hotByPremium } from "./rank";
import { parseUniverse, rotatingSlice } from "@/lib/live/universe";

const print = (root: string, premium: number, time = "2026-11-13T15:00:00.000Z"): FlowPrint => ({
  time, contract: root, root, expiry: "2026-11-20", strike: 100, right: "call", side: "ASK", size: 1, price: 1,
  premium, delta: 0.4, conditions: [], inferred: false, sentiment: "bullish", flags: [],
});

describe("universe, hot names, and forward returns", () => {
  it("defaults to about 50 names and rotates a batch", () => {
    const symbols = parseUniverse(undefined);
    expect(symbols.length).toBeGreaterThanOrEqual(48);
    expect(symbols.length).toBeLessThanOrEqual(55);
    const first = rotatingSlice(symbols, 0, 8);
    expect(first.batch).toHaveLength(8);
    expect(first.next).toBe(8);
  });

  it("ranks premium and scores a one-day forward move", () => {
    expect(hotByPremium([print("AAA", 10), print("BBB", 50)])[0].symbol).toBe("BBB");
    const result = flowForward(
      [print("SPY", 10, "2026-11-02T15:00:00.000Z")],
      [{ date: "2026-11-02", close: 100 }, { date: "2026-11-03", close: 110 }, { date: "2026-11-04", close: 90 }],
      1,
    );
    expect(result.n).toBe(1);
    expect(result.hits).toBe(1);
    expect(result.wilsonLo).toBeGreaterThanOrEqual(0);
  });
});
