import { describe, expect, it } from "vitest";
import { chartPath, readTicker, tickerPath } from "./route";

describe("ticker route", () => {
  it("prefers the query, then the hash", () => {
    expect(tickerPath("nvda")).toBe("/t/?s=NVDA");
    expect(chartPath("nvda")).toBe("/chart/?s=NVDA&tf=1d");
    expect(readTicker("?s=amd", "#SPY")).toBe("AMD");
    expect(readTicker("", "#tsla")).toBe("TSLA");
    expect(readTicker("", "", "QQQ")).toBe("QQQ");
    expect(readTicker("?s=bad symbol", "")).toBe("SPY");
  });
});
