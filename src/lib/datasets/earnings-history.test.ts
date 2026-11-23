import { describe, expect, it } from "vitest";
import { averageAbsMove, candidateExpiries, candidateStrikes, mergeEarningsRows, occSymbol, parseSurprise, parseUpcoming, straddleFromBars, straddleImplied, windowMove, type EarningsRow } from "./earnings-history";

const bar = (day: string, close: number) => ({ time: Date.parse(`${day}T05:00:00Z`), close });

describe("earnings history", () => {
  it("parses Nasdaq surprise rows and the upcoming date", () => {
    const rows = parseSurprise({ data: { earningsSurpriseTable: { rows: [{ fiscalQtrEnd: "Oct 2026", dateReported: "11/17/2026", eps: 2.68, consensusForecast: "2.47", percentageSurprise: "8.5" }, { dateReported: "bad" }] } } });
    expect(rows).toEqual([{ reportDate: "2026-11-17", fiscalQuarter: "Oct 2026", eps: 2.68, consensus: 2.47, surprisePct: 8.5 }]);
    expect(parseUpcoming({ data: { announcement: "Earnings announcement* for NVDA: Feb 25, 2027" } })).toBe("2027-02-25");
    expect(parseUpcoming({ data: { announcement: "Earnings announcement* for AAPL: " } })).toBeNull();
  });

  it("measures close before to first close after the report", () => {
    const bars = [bar("2026-11-13", 150), bar("2026-11-16", 156.14), bar("2026-11-17", 155), bar("2026-11-18", 150.96)];
    const move = windowMove(bars, "2026-11-17");
    expect(move).toMatchObject({ beforeDate: "2026-11-16", afterDate: "2026-11-18", closeBefore: 156.14, closeAfter: 150.96 });
    expect(move!.move).toBeCloseTo(-0.0332, 3);
    expect(windowMove(bars, "2026-11-18")).toBeNull();
    expect(windowMove([bar("2026-10-01", 100), bar("2026-11-18", 120)], "2026-11-17")).toBeNull();
  });

  it("prices an ATM straddle for the first expiry after the report", () => {
    const options = [
      { option: "NVDA261120C00155000", bid: 7, ask: 7.4 },
      { option: "NVDA261120P00155000", bid: 6.8, ask: 7.2 },
      { option: "NVDA261117C00155000", bid: 1, ask: 1.2 },
      { option: "NVDA261117P00155000", bid: 1, ask: 1.2 },
    ];
    const straddle = straddleImplied(options, 156, "2026-11-17");
    expect(straddle?.expiry).toBe("2026-11-20");
    expect(straddle?.implied).toBeCloseTo(14.2 / 156, 5);
    expect(straddleImplied(options, 0, "2026-11-17")).toBeNull();
    expect(straddleImplied([{ option: "NVDA261120C00155000", bid: 0, ask: 0 }], 156, "2026-11-17")).toBeNull();
  });

  it("builds Alpaca candidates and reads the straddle on the close-before date", () => {
    expect(candidateExpiries("2026-11-17", 1)).toEqual(["2026-11-19", "2026-11-20"]);
    expect(candidateStrikes(156.14).slice(0, 3)).toEqual([156, 157, 155]);
    expect(occSymbol("NVDA", "2026-11-20", "C", 155)).toBe("NVDA261120C00155000");
    const bars = {
      NVDA261120C00155000: [{ t: "2026-11-16T05:00:00Z", c: 7.5 }],
      NVDA261120P00155000: [{ t: "2026-11-16T05:00:00Z", c: 6.5 }],
      NVDA261120C00300000: [{ t: "2026-11-16T05:00:00Z", c: 0.01 }],
    };
    expect(straddleFromBars(bars, "2026-11-16", 156.14)?.implied).toBeCloseTo(14 / 156.14, 5);
    expect(straddleFromBars(bars, "2026-11-13", 156.14)).toBeNull();
  });

  it("keeps a captured implied when a later run has none", () => {
    const base: EarningsRow = { sym: "ZZ", reportDate: "2026-11-17", fiscalQuarter: null, surprisePct: null, beforeDate: "2026-11-16", afterDate: "2026-11-18", closeBefore: 10, closeAfter: 11, realized: 0.1, implied: 0.05, impliedSource: "Cboe", impliedExpiry: "2026-11-20" };
    const merged = mergeEarningsRows([base], [{ ...base, implied: null, impliedSource: null, impliedExpiry: null, closeAfter: 11.5, realized: 0.15 }]);
    expect(merged[0].implied).toBe(0.05);
    expect(merged[0].realized).toBe(0.15);
    expect(averageAbsMove([{ realized: 0.1 }, { realized: -0.2 }])).toBeCloseTo(0.15);
    expect(averageAbsMove([])).toBeNull();
  });
});
