import { describe, expect, it } from "vitest";
import type { FlowPrint } from "./classify.ts";
import { connectionLabel, cumulativeTide, isUnusual, lastSessionReplay, mergePrints, passesTapeFilter, priceLevels, sectorTide } from "./tape.ts";

function print(partial: Partial<FlowPrint>): FlowPrint {
  return {
    time: "2026-11-13T15:00:00.000Z",
    contract: "NVDA1",
    root: "NVDA",
    expiry: "2026-11-20",
    strike: 200,
    right: "call",
    side: "ASK",
    size: 10,
    price: 2,
    premium: 12_000,
    delta: 0.4,
    conditions: [],
    inferred: false,
    sentiment: "bullish",
    flags: [],
    ...partial,
  };
}

describe("tape filters and tide", () => {
  it("keeps an unusual short-dated ask print and drops a sweep-only miss", () => {
    const now = new Date("2026-11-13T16:00:00Z");
    const unusual = print({});
    expect(isUnusual(unusual, now, 180)).toBe(true);
    expect(passesTapeFilter(unusual, { minPremium: 10_000, right: "call", sweepsOnly: true, ticker: "NVDA", maxDte: 30, otmOnly: true, unusual: true, spots: { NVDA: 180 } }, now)).toBe(false);
  });

  it("cumulates call premium and groups a technology name", () => {
    const points = cumulativeTide([
      print({ time: "2026-11-13T15:00:10.000Z", premium: 5_000, size: 10 }),
      print({ time: "2026-11-13T15:01:10.000Z", premium: 2_000, size: 4, side: "BID", sentiment: "bearish" }),
    ]);
    expect(points.at(-1)?.call).toBe(3_000);
    expect(sectorTide([print({})])[0]).toEqual({ name: "XLK", net: 12_000 });
  });

  it("aggregates off-exchange size into price levels and labels a closed tape", () => {
    const levels = priceLevels([
      { price: 100, size: 10 },
      { price: 100.05, size: 5 },
    ]);
    expect(levels[0].shares).toBeGreaterThan(0);
    const prints = [print({})];
    expect(mergePrints(prints, prints)).toHaveLength(1);
    expect(connectionLabel({ online: true, streaming: false, sessionOpen: false })).toBe("delayed 15m");
    expect(lastSessionReplay(prints, new Date("2026-11-15T18:00:00Z"))).toBe(true);
  });
});
