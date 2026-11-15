import { describe, expect, it } from "vitest";
import { parseCnbcBars, parseCnbcStamp } from "./cnbc";

describe("parseCnbcStamp", () => {
  it("reads a 4pm New York stamp as 21:00 UTC in November", () => {
    const ms = parseCnbcStamp("20261113160000");
    expect(ms).not.toBeNull();
    expect(new Date(ms ?? 0).toISOString()).toBe("2026-11-13T21:00:00.000Z");
  });
});

describe("parseCnbcBars", () => {
  it("drops a bar with a bad close and keeps the rest in time order", () => {
    const bars = parseCnbcBars([
      { open: "2", high: "3", low: "1", close: "2.5", volume: 5, tradeTime: "20261113160100" },
      { open: "1", high: "2", low: "1", close: "bad", volume: 1, tradeTime: "20261113160000" },
      { open: "1", high: "1.5", low: "0.5", close: "1.2", volume: 4, tradeTime: "20261113155900" },
    ]);
    expect(bars.map((bar) => bar.close)).toEqual([1.2, 2.5]);
  });
});
