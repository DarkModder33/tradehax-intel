import { describe, expect, it } from "vitest";
import { THRESHOLDS, buildStories, flowStories, gammaStories, usableInput, validateStory, wordCount } from "../../../scripts/news/engine.mjs";
import { appendOptionsDays, optionsDay, sessionDate, type DayContract } from "../datasets/options-day";

const NOW = "2026-11-23T22:00:00.000Z";
const asOf = "2026-11-23T21:30:00.000Z";

function day(date: string, over: Record<string, unknown> = {}) {
  return { date, spot: 700, callVolume: 300_000, putVolume: 300_000, callPremium: 9e7, putPremium: 8e7, netGex: 2e9, flip: 690, regime: "long", asOf: `${date} 21:00:00`, ...over };
}

const dates = ["2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-23"];

function history(last: Record<string, unknown>) {
  return { asOf, series: { SPY: [...dates.slice(0, -1).map((date) => day(date)), day(dates.at(-1)!, last)] } };
}

describe("event stories", () => {
  it("writes a flow spike against the median of prior sessions", () => {
    const stories = flowStories(history({ callVolume: 1_400_000, putVolume: 600_000 }), "2026-11-23");
    expect(stories).toHaveLength(1);
    expect(stories[0].headline).toContain("3.3x");
    expect(stories[0].headline).toContain("call-heavy");
    expect(wordCount(stories[0].body)).toBeGreaterThanOrEqual(300);
    expect(validateStory(stories[0], new Date(NOW))).toEqual([]);
  });

  it("skips a flow spike with blank, zero, or too little history", () => {
    expect(flowStories(history({ callVolume: null, putVolume: null }), "2026-11-23")).toEqual([]);
    expect(flowStories(history({ callVolume: 0, putVolume: 0 }), "2026-11-23")).toEqual([]);
    expect(flowStories({ series: { SPY: [day("2026-11-20"), day("2026-11-23", { callVolume: 5e6 })] } }, "2026-11-23")).toEqual([]);
    expect(flowStories(history({ callVolume: 700_000, putVolume: 600_000 }), "2026-11-23")).toEqual([]);
  });

  it("writes a gamma flip only when both sessions carry size and change sign", () => {
    const flipped = gammaStories(history({ netGex: -3e9, flip: 712.5 }), "2026-11-23");
    expect(flipped).toHaveLength(1);
    expect(flipped[0].headline).toBe("SPY dealers flip to short gamma with the flip at $712.50");
    expect(validateStory(flipped[0], new Date(NOW))).toEqual([]);
    expect(gammaStories(history({ netGex: 3e9 }), "2026-11-23")).toEqual([]);
    expect(gammaStories(history({ netGex: -1e6 }), "2026-11-23")).toEqual([]);
    expect(gammaStories(history({ netGex: null }), "2026-11-23")).toEqual([]);
    expect(gammaStories(history({ netGex: 0 }), "2026-11-23")).toEqual([]);
  });

  it("requires a recent, fully priced insider cluster", () => {
    const insiders = (filed: string, price: number | null) => ({
      meta: { asOf, source: "SEC EDGAR Form 4" },
      rows: [
        { filed, trade: { ticker: "ZZ", code: "P", acquired: true, owner: "Ada", shares: 1000, price } },
        { filed, trade: { ticker: "ZZ", code: "P", acquired: true, owner: "Bea", shares: 2000, price } },
      ],
    });
    const fresh = buildStories({ insiders: insiders("2026-11-20", 10) }, { now: NOW });
    expect(fresh.map((story: { type: string }) => story.type)).toEqual(["insider"]);
    expect(fresh[0].headline).toBe("2 insiders bought $30.0K of ZZ in the open market");
    expect(buildStories({ insiders: insiders("2026-10-01", 10) }, { now: NOW })).toEqual([]);
    expect(buildStories({ insiders: insiders("2026-11-20", null) }, { now: NOW })).toEqual([]);
    expect(buildStories({ insiders: insiders("2026-11-20", 0) }, { now: NOW })).toEqual([]);
  });
});

describe("validation gate", () => {
  const good = () => flowStories(history({ callVolume: 1_400_000, putVolume: 600_000 }), "2026-11-23")[0];

  it("refuses placeholders, blanks, zeros, and non-finite sparks", () => {
    expect(validateStory({ ...good(), headline: "SPY moved NaN%" }, new Date(NOW))).toContain("placeholder in headline or dek");
    expect(validateStory({ ...good(), keyNumbers: [{ label: "x", value: "n/a" }] }, new Date(NOW))).toContain("blank key number x");
    expect(validateStory({ ...good(), keyNumbers: [{ label: "x", value: "$0.00" }] }, new Date(NOW))).toContain("zero key number x");
    expect(validateStory({ ...good(), keyNumbers: [{ label: "x", value: "+0.0%" }] }, new Date(NOW))).toContain("zero key number x");
    expect(validateStory({ ...good(), keyNumbers: [] }, new Date(NOW))).toContain("no key numbers");
    expect(validateStory({ ...good(), spark: [1, Number.NaN] }, new Date(NOW))).toContain("non-finite spark");
    expect(validateStory({ ...good(), body: ["value undefined"] }, new Date(NOW))).toContain("placeholder in body");
  });

  it("refuses stale data by type", () => {
    expect(validateStory({ ...good(), dataDate: "2026-11-10" }, new Date(NOW))).toContain(`data older than 3 days`);
    expect(validateStory({ ...good(), dataDate: "bad" }, new Date(NOW))).toContain("no data date");
  });

  it("skips stale or unavailable input files before any generator runs", () => {
    expect(usableInput({ meta: { asOf } }, new Date(NOW))).toBe(true);
    expect(usableInput({ meta: { asOf: "2026-11-20T00:00:00Z" } }, new Date(NOW))).toBe(false);
    expect(usableInput({ meta: { asOf, unavailable: true } }, new Date(NOW))).toBe(false);
    expect(usableInput(null, new Date(NOW))).toBe(false);
    const stale = { meta: { asOf: "2026-11-10T00:00:00Z", source: "x" }, rows: { NVDA: { ret5d: -0.2, rvol20: 2 } } };
    expect(buildStories({ technicals: stale }, { now: NOW })).toEqual([]);
    expect(THRESHOLDS.inputMaxAgeHours).toBe(36);
  });
});

describe("options day", () => {
  const contracts: DayContract[] = [
    { right: "call", strike: 710, expiry: "2026-12-18", iv: 0.2, gamma: 0, openInterest: 50_000, volume: 1000, last: 10 },
    { right: "put", strike: 690, expiry: "2026-12-18", iv: 0.22, gamma: 0, openInterest: 80_000, volume: 2000, last: 8 },
  ];

  it("sums volume and premium by side and finds the flip above spot for a put-heavy book", () => {
    const row = optionsDay(contracts, 700, "2026-11-23", new Date(NOW));
    expect(row?.callVolume).toBe(1000);
    expect(row?.putPremium).toBe(1_600_000);
    expect(row?.flip).not.toBeNull();
    // Put gamma dominates at spot, so the book turns positive only above the call strike.
    expect(row!.netGex!).toBeLessThan(0);
    expect(row!.flip!).toBeGreaterThan(700);
  });

  it("leaves volume blank when the feed carries none", () => {
    const row = optionsDay(contracts.map((contract) => ({ ...contract, volume: 0 })), 700, "2026-11-23", new Date(NOW));
    expect(row?.callVolume).toBeNull();
    expect(row?.callPremium).toBeNull();
    expect(optionsDay([], 700, "2026-11-23", new Date(NOW))).toBeNull();
    expect(optionsDay(contracts, 0, "2026-11-23", new Date(NOW))).toBeNull();
  });

  it("replaces the same session and skips weekends", () => {
    const one = optionsDay(contracts, 700, "2026-11-23", new Date(NOW))!;
    const series = appendOptionsDays(appendOptionsDays({}, [{ symbol: "SPY", day: one }]), [{ symbol: "SPY", day: { ...one, spot: 701 } }]);
    expect(series.SPY).toHaveLength(1);
    expect(series.SPY[0].spot).toBe(701);
    expect(sessionDate(new Date("2026-11-21T18:00:00Z"))).toBeNull();
    expect(sessionDate(new Date("2026-11-24T02:00:00Z"))).toBe("2026-11-23");
  });
});

describe("earnings recap recency", () => {
  const file = (afterDate: string) => ({ meta: { asOf, source: "earnings" }, rows: [{ sym: "ZZ", reportDate: "2026-08-20", beforeDate: "2026-08-19", afterDate, implied: 0.05, realized: -0.11 }] });
  it("writes a recap only for a reaction that closed in the last few days", () => {
    expect(buildStories({ earnings: file("2026-11-21") }, { now: NOW }).map((story: { type: string }) => story.type)).toEqual(["earnings"]);
    expect(buildStories({ earnings: file("2026-08-21") }, { now: NOW })).toEqual([]);
    expect(buildStories({ earnings: file("") }, { now: NOW })).toEqual([]);
  });
});
