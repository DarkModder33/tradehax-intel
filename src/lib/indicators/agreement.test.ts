import { describe, expect, it } from "vitest";
import { describeAgreement } from "./agreement";
import type { Direction, Signal, Timeframe } from "./types";

function signal(timeframe: Timeframe, direction: Direction): Signal {
  return {
    symbol: "TEST",
    timeframe,
    direction,
    probability: direction === "neutral" ? 0 : 60,
    net: 0,
    agreement: 0,
    summary: "",
    factors: [],
    price: 1,
    asOf: 0,
    barCount: 50,
    trail: [],
  };
}

describe("describeAgreement", () => {
  it("states a clean sweep in one sentence", () => {
    const report = describeAgreement([
      signal("1m", "bullish"),
      signal("5m", "bullish"),
      signal("15m", "bullish"),
      signal("1h", "bullish"),
      signal("4h", "bullish"),
      signal("1d", "bullish"),
    ]);
    expect(report.direction).toBe("bullish");
    expect(report.label).toBe("6 of 6 lean bullish");
    expect(report.narrative).toBe("All 6 timeframes lean bullish.");
  });

  it("calls out a short-term fight against the higher timeframes", () => {
    const report = describeAgreement([
      signal("1d", "bullish"),
      signal("1m", "bearish"),
      signal("4h", "bullish"),
      signal("5m", "bearish"),
      signal("1h", "bullish"),
      signal("15m", "bearish"),
    ]);
    expect(report.direction).toBe("split");
    expect(report.label).toBe("Trends conflict");
    expect(report.narrative).toBe(
      "The 1h, 4h and 1D timeframes lean bullish, while 1m, 5m and 15m lean bearish. The short-term tape is fighting the larger trend.",
    );
  });

  it("counts a majority and names the holdouts", () => {
    const report = describeAgreement([
      signal("1m", "bearish"),
      signal("5m", "neutral"),
      signal("15m", "bullish"),
      signal("1h", "bullish"),
      signal("4h", "bullish"),
      signal("1d", "bullish"),
    ]);
    expect(report.narrative).toBe(
      "4 of 6 timeframes lean bullish. 1m leans bearish. 5m is mixed.",
    );
  });

  it("says when the board is split or empty of leans", () => {
    const split = describeAgreement([
      signal("1m", "bullish"),
      signal("5m", "bearish"),
      signal("15m", "bullish"),
      signal("1h", "bearish"),
      signal("4h", "bullish"),
      signal("1d", "bearish"),
    ]);
    expect(split.narrative).toBe(
      "Timeframes are split, 3 bullish and 3 bearish, so there is no confluence.",
    );

    const quiet = describeAgreement([
      signal("1m", "neutral"),
      signal("1h", "neutral"),
    ]);
    expect(quiet.narrative).toBe("No timeframe has a clear lean.");
  });
});
