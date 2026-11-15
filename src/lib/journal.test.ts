import { describe, expect, it } from "vitest";
import type { Bar, Signal } from "@/lib/indicators/types";
import { journalLine, summarizeJournal, updateJournal } from "./journal";

function bar(index: number, close: number): Bar {
  return {
    time: 1_000_000 + index * 60_000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
  };
}

function signal(asOf: number, price: number): Signal {
  return {
    symbol: "AAA",
    timeframe: "1m",
    direction: "bullish",
    probability: 60,
    net: 0.4,
    agreement: 1,
    summary: "Up.",
    factors: [],
    price,
    asOf,
    barCount: 50,
    trail: [],
  };
}

describe("updateJournal", () => {
  it("logs a call once and settles it after the forward window", () => {
    const short = Array.from({ length: 6 }, (_, index) => bar(index, 100 + index));
    const logged = updateJournal([], [signal(short[2].time, short[2].close)], [{ symbol: "AAA", bars: { "1m": short } }], 50);
    expect(logged).toHaveLength(1);
    expect(logged[0].settled).toBeNull();

    const bars = Array.from({ length: 12 }, (_, index) => bar(index, 100 + index));
    const again = updateJournal(logged, [signal(bars[2].time, bars[2].close)], [{ symbol: "AAA", bars: { "1m": bars } }], 80);
    expect(again).toHaveLength(1);
    expect(again[0].loggedAt).toBe(50);
    // 1m horizon is 5 bars: close goes from 102 to 107.
    expect(again[0].settled?.hit).toBe(true);
    expect(again[0].settled?.forwardReturn).toBeCloseTo(5 / 102, 6);
  });

  it("summarizes settled hits", () => {
    const summary = summarizeJournal([
      {
        id: "a",
        symbol: "AAA",
        timeframe: "1d",
        direction: "bearish",
        probability: 50,
        price: 10,
        asOf: 1,
        loggedAt: 1,
        settled: { exitPrice: 9, forwardReturn: -0.1, calledReturn: 0.1, hit: true, barsAhead: 5 },
      },
      {
        id: "b",
        symbol: "AAA",
        timeframe: "1d",
        direction: "bullish",
        probability: 50,
        price: 10,
        asOf: 2,
        loggedAt: 2,
        settled: null,
      },
    ]);
    expect(summary).toEqual({ open: 1, settled: 1, hits: 1, hitRate: 1 });
    expect(journalLine(summary)).toMatch(/1 settled call, right 1 time \(100%\)/);
  });
});
