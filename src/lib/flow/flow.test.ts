import { describe, expect, it } from "vitest";
import { inferSide, isBlock, isOffExchange, sentiment, withFlags, type FlowPrint } from "./classify";
import { diffChain } from "./diff";
import { nope } from "./nope";
import { intervalUnusual, repeatedHits } from "./rules";
import { tideBar } from "./tide";
import type { ChainContract } from "@/lib/sources/cboe";

function contract(partial: Partial<ChainContract> & Pick<ChainContract, "symbol" | "volume">): ChainContract {
  return {
    root: "SPY",
    expiry: "2026-11-20",
    right: "call",
    strike: 760,
    bid: 1,
    ask: 1.2,
    iv: 0.2,
    delta: 0.4,
    gamma: 0.01,
    vega: 0.1,
    theta: -0.02,
    rho: 0,
    theo: 1.1,
    openInterest: 10,
    last: 1.2,
    lastTradeTime: null,
    ...partial,
  };
}

function print(partial: Partial<FlowPrint>): FlowPrint {
  return {
    time: "2026-11-13T15:00:00.000Z",
    contract: "SPY1",
    root: "SPY",
    expiry: "2026-11-20",
    strike: 760,
    right: "call",
    side: "ASK",
    size: 1,
    price: 1,
    premium: 100,
    delta: 0.4,
    conditions: [],
    inferred: false,
    sentiment: "bullish",
    flags: [],
    ...partial,
  };
}

describe("flow classification", () => {
  it("marks a fill at the ask and a bullish call", () => {
    expect(inferSide(1.2, 1, 1.2)).toBe("ASK");
    expect(inferSide(1.1, 1, 1.2)).toBe("MID");
    expect(sentiment("call", "ASK")).toBe("bullish");
    expect(sentiment("put", "ASK")).toBe("bearish");
  });

  it("emits an inferred print for the volume increase", () => {
    const prints = diffChain([contract({ symbol: "SPY1", volume: 10 })], [contract({ symbol: "SPY1", volume: 15, last: 1.2 })], "2026-11-13T15:00:00Z");
    expect(prints).toHaveLength(1);
    expect(prints[0].size).toBe(5);
    expect(prints[0].premium).toBe(600);
    expect(prints[0].inferred).toBe(true);
    expect(prints[0].side).toBe("ASK");
  });

  it("flags a two-exchange sweep, a block, and an off-exchange print", () => {
    const flagged = withFlags([
      print({ time: "2026-11-13T15:00:00.000Z", exchange: "C", size: 10, premium: 1000 }),
      print({ time: "2026-11-13T15:00:00.200Z", exchange: "P", size: 10, premium: 1000 }),
      print({ contract: "BIG", size: 100, premium: 50_000, exchange: "D" }),
    ]);
    expect(flagged[0].flags).toContain("sweep");
    expect(flagged[2].flags).toContain("block");
    expect(isBlock(100, 1)).toBe(true);
    expect(isOffExchange("D")).toBe(true);
  });

  it("fires repeated hits and builds a tide bar", () => {
    const burst = Array.from({ length: 6 }, (_, index) =>
      print({ time: new Date(Date.parse("2026-11-13T15:00:00.000Z") + index * 10).toISOString(), premium: 2_000, size: 1 }),
    );
    expect(repeatedHits(burst)[0].rule).toBe("RepeatedHits");
    const bar = tideBar([
      print({ right: "call", side: "ASK", premium: 5_000, size: 10, delta: 0.4 }),
      print({ right: "call", side: "BID", premium: 1_000, size: 4, delta: 0.4 }),
      print({ right: "put", side: "MID", premium: 9_000, size: 20, delta: -0.4 }),
    ]);
    expect(bar.netCallPremium).toBe(4_000);
    expect(bar.netPutPremium).toBe(0);
  });

  it("computes NOPE and the interval-unusual check", () => {
    expect(nope([{ right: "call", volume: 10, delta: 0.5 }, { right: "put", volume: 4, delta: -0.25 }], 100)).toBeCloseTo(4);
    expect(intervalUnusual(print({ size: 60, premium: 100_000, side: "ASK" }), 100)).toBe(true);
    expect(intervalUnusual(print({ size: 10, premium: 100_000, side: "ASK" }), 100)).toBe(false);
  });
});
