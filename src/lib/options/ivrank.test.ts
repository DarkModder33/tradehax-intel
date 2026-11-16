import { describe, expect, it } from "vitest";
import { appendIvHistory, asDecimalVol, closeToCloseVol, ivPercentile, ivRank, varianceRiskPremium, yangZhang } from "./ivrank";

describe("IV rank", () => {
  it("returns null until 20 points and when the range is flat", () => {
    expect(ivRank([0.2, 0.3])).toBeNull();
    expect(ivRank(Array.from({ length: 20 }, () => 0.2))).toBeNull();
    const rising = Array.from({ length: 20 }, (_, index) => 0.1 + index * 0.01);
    expect(ivRank(rising)).toBeCloseTo(1, 6);
    expect(ivPercentile(rising)).toBe(1);
    expect(ivPercentile([0.2, 0.1, ...Array.from({ length: 18 }, () => 0.3)])).toBeGreaterThan(0);
  });

  it("dedupes a session, caps the series, and keeps the variance premium sign", () => {
    const once = appendIvHistory({}, [{ sym: "SPY", date: "2026-11-14", iv30: 14.8, close: 500 }]);
    const twice = appendIvHistory(once, [{ sym: "SPY", date: "2026-11-14", iv30: 15, close: 501 }]);
    expect(twice.SPY).toEqual([["2026-11-14", 0.15, 501]]);
    const long = appendIvHistory(
      {},
      Array.from({ length: 405 }, (_, index) => ({
        sym: "QQQ",
        date: new Date(Date.UTC(2018, 0, 1 + index)).toISOString().slice(0, 10),
        iv30: 0.2,
        close: 1,
      })),
    );
    expect(long.QQQ).toHaveLength(400);
    expect(varianceRiskPremium(0.3, 0.2)).toBeCloseTo(0.1);
    expect(varianceRiskPremium(0.1, 0.2)).toBeLessThan(0);
    expect(asDecimalVol(14.8)).toBeCloseTo(0.148);
    const closes = Array.from({ length: 21 }, (_, index) => 100 * Math.exp(index * 0.001));
    expect(closeToCloseVol(closes, 20)).toBeGreaterThan(0);
    const bars = closes.map((close) => ({ open: close * 0.999, high: close * 1.01, low: close * 0.99, close }));
    expect(yangZhang(bars, 20)).toBeGreaterThan(0);
  });
});
