import { describe, expect, it } from "vitest";
import { chartPath, readTicker, readTickerTab, tickerPath, tickerTabPath } from "./route";

describe("ticker route", () => {
  it("prefers the query, then the hash", () => {
    expect(tickerPath("nvda")).toBe("/t/?s=NVDA");
    expect(chartPath("nvda")).toBe("/chart/?s=NVDA&tf=1d");
    expect(readTicker("?s=amd", "#SPY")).toBe("AMD");
    expect(readTicker("", "#tsla")).toBe("TSLA");
    expect(readTicker("", "", "QQQ")).toBe("QQQ");
    expect(readTicker("?s=bad symbol", "")).toBe("SPY");
  });

  it("reads ticker tabs and falls back to overview", () => {
    expect(readTickerTab("?s=NVDA&tab=flow")).toBe("flow");
    expect(readTickerTab("?tab=nope")).toBe("overview");
    expect(tickerTabPath("nvda", "earnings")).toBe("/t/?s=NVDA&tab=earnings");
    expect(tickerTabPath("NVDA")).toBe("/t/?s=NVDA");
  });
});
