import { describe, expect, it } from "vitest";
import { classifyRisk, rankSectors, regimeNote, trendSide, volatilityRegime } from "./context";

describe("market regime", () => {
  it("labels VIX bands", () => {
    expect(volatilityRegime(12)).toBe("calm");
    expect(volatilityRegime(16)).toBe("normal");
    expect(volatilityRegime(24)).toBe("elevated");
    expect(volatilityRegime(32)).toBe("stress");
  });

  it("calls the tape risk-off when VIX is high and an index is below its average", () => {
    const closes = [...Array.from({ length: 19 }, () => 100), 90];
    expect(trendSide(closes)).toBe("down");
    expect(classifyRisk({ vix: 24, spyTrend: "down", qqqTrend: "up" })).toBe("risk-off");
    expect(classifyRisk({ vix: 14, spyTrend: "up", qqqTrend: "up" })).toBe("risk-on");
    expect(regimeNote("bullish", "risk-off")).toBe("Bullish signal against a risk-off market.");
    expect(regimeNote("bearish", "risk-on")).toBe("Bearish signal against a risk-on market.");
  });

  it("ranks sector excess return against SPY", () => {
    const spy = Array.from({ length: 21 }, (_, index) => 100 + index);
    const tech = Array.from({ length: 21 }, (_, index) => 100 + index * 2);
    const energy = Array.from({ length: 21 }, () => 100);
    const ranked = rankSectors(
      [
        { symbol: "XLE", name: "Energy", closes: energy },
        { symbol: "XLK", name: "Technology", closes: tech },
      ],
      spy,
    );
    expect(ranked.map((item) => item.symbol)).toEqual(["XLK", "XLE"]);
    expect(ranked[0].excessVsSpy).toBeGreaterThan(0);
    expect(ranked[1].excessVsSpy).toBeLessThan(0);
  });
});
