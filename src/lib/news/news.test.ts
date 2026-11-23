import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DISCLAIMER, THRESHOLDS, buildStories, mergeStories, wordCount } from "../../../scripts/news/engine.mjs";
import { freshStories, xmlEscape } from "../../../scripts/news/feeds.mjs";
import type { Story } from "./load";

function built(input: unknown, options?: { cap: number; perType?: number }): Story[] {
  return buildStories(input, options) as Story[];
}

const asOf = "2026-11-16T21:00:00.000Z";

function technicals(rows: Record<string, Record<string, number>>) {
  return { meta: { asOf, source: "Yahoo daily bars" }, rows };
}

describe("story generator", () => {
  it("publishes a material mover and skips a quiet name", () => {
    const stories = built({
      technicals: technicals({
        NVDA: { ret5d: -0.13, ret1m: -0.2, ret3m: -0.27, rvol20: 1.8, rsi14: 25, atrPct: 0.06, pctFrom52wHigh: -0.33 },
        KO: { ret5d: 0.01, ret1m: 0.02, ret3m: 0.03, rvol20: 0.9, rsi14: 55, atrPct: 0.01, pctFrom52wHigh: -0.02 },
      }),
    });
    expect(stories.map((story) => story.ticker)).toEqual(["NVDA"]);
    const story = stories[0];
    expect(wordCount(story.body)).toBeGreaterThanOrEqual(300);
    expect(wordCount(story.body)).toBeLessThanOrEqual(600);
    expect(story.disclaimer).toBe(DISCLAIMER);
    expect(story.passedMateriality).toBe(true);
    expect(story.keyNumbers.every((item) => item.source === "Yahoo daily bars" && item.asOf === asOf)).toBe(true);
    expect(story.body.join(" ")).toContain("-13.0%");
    expect(story.methodology).toBe("/about/methodology/");
  });

  it("varies the lead between two tickers and caps the day", () => {
    const rows: Record<string, Record<string, number>> = {};
    for (let index = 0; index < 14; index += 1) {
      rows[`N${index}`] = { ret5d: 0.08 + index / 100, ret1m: 0.02, ret3m: 0.03, rvol20: 2, rsi14: 60, atrPct: 0.02, pctFrom52wHigh: -0.1 };
    }
    const stories = built({ technicals: technicals(rows) }, { cap: THRESHOLDS.cap });
    // One busy type cannot fill the wire: at most THRESHOLDS.perType movers per run.
    expect(stories.length).toBe(THRESHOLDS.perType);
    const unlimited = built({ technicals: technicals(rows) }, { cap: THRESHOLDS.cap, perType: THRESHOLDS.cap });
    expect(unlimited.length).toBe(THRESHOLDS.cap);
    expect(new Set(stories.map((story) => story.id)).size).toBe(stories.length);
    const leads = new Set(stories.map((story) => story.body[0].slice(0, 24)));
    expect(leads.size).toBeGreaterThan(1);
  });

  it("does not invent earnings, iv rank, insider clusters, or a macro change", () => {
    const quiet = built({
      earnings: { rows: [], note: "Building" },
      ivHistory: { series: { SPY: [["2026-11-01", 14, 500]] } },
      insiders: { meta: { asOf, source: "SEC EDGAR Form 4" }, rows: [{ trade: { ticker: "ACEL", code: "P", acquired: true, owner: "Ada", shares: 10, price: 3 }, filed: "2026-11-12" }] },
      macro: { meta: { asOf, source: "FRED public CSV" }, rows: [{ id: "DGS10", value: 4.2 }] },
      oiChange: { meta: { unavailable: true }, rows: [] },
    });
    expect(quiet).toEqual([]);
  });

  it("writes a cluster, a rates move, an OI change, and an earnings gap when the rows exist", () => {
    const history = Array.from({ length: 20 }, (_, index) => [`2026-01-${String(index + 1).padStart(2, "0")}`, 10 + index, 100]);
    const stories = built({
      insiders: {
        meta: { asOf, source: "SEC EDGAR Form 4" },
        rows: [
          { filed: "2026-11-12", trade: { ticker: "ZZ", code: "P", acquired: true, owner: "Ada", shares: 100, price: 10 } },
          { filed: "2026-11-12", trade: { ticker: "ZZ", code: "P", acquired: true, owner: "Bea", shares: 200, price: 11 } },
          { filed: "2026-11-12", trade: { ticker: "ZZ", code: "S", acquired: false, owner: "Cy", shares: 50, price: 12 } },
        ],
      },
      macro: { meta: { asOf, source: "FRED public CSV" }, rows: [{ id: "DGS10", value: 4.4 }] },
      macroPrevious: { rows: [{ id: "DGS10", value: 4.1 }] },
      oiChange: {
        meta: { asOf, source: "Cboe open interest", unavailable: false },
        rows: [{ symbol: "ZZ261218C00100000", previous: 1000, current: 1800, change: 800 }],
      },
      earnings: { meta: { asOf, source: "Cboe straddle vs later close" }, rows: [{ symbol: "ZZ", implied: 0.04, realized: 0.09 }] },
      ivHistory: { series: { ZZ: history } },
    });
    const types = stories.map((story) => story.type).sort();
    expect(types).toEqual(["earnings", "insider", "iv", "macro", "unusual"]);
    expect(stories.every((story) => wordCount(story.body) >= 300 && wordCount(story.body) <= 600)).toBe(true);
  });

  it("replaces the same id when a later run has new numbers", () => {
    const first = built({ technicals: technicals({ NVDA: { ret5d: -0.12, ret1m: -0.1, ret3m: -0.2, rvol20: 1.6, rsi14: 30, atrPct: 0.05, pctFrom52wHigh: -0.2 } }) });
    const second = built({ technicals: technicals({ NVDA: { ret5d: -0.2, ret1m: -0.1, ret3m: -0.2, rvol20: 2, rsi14: 22, atrPct: 0.05, pctFrom52wHigh: -0.3 } }) });
    const merged = mergeStories(first, second, 45, new Date("2026-11-20T00:00:00Z"));
    expect(merged).toHaveLength(1);
    expect(merged[0].headline).toContain("-20.0%");
  });

  it("uses the checked-in datasets without inventing an earnings recap", () => {
    const load = (name: string) => JSON.parse(readFileSync(`public/data/${name}`, "utf8"));
    const stories = built({
      technicals: load("technicals.json"),
      shorts: load("shorts.json"),
      ftd: load("ftd.json"),
      insiders: load("insiders.json"),
      oiChange: load("oi-change.json"),
      earnings: load("earnings-moves.json"),
      iv: load("iv.json"),
      ivHistory: load("iv-history.json"),
    });
    expect(stories.some((story) => story.ticker === "NVDA" && story.type === "mover")).toBe(true);
    expect(stories.some((story) => story.type === "earnings" || story.type === "iv" || story.type === "insider")).toBe(false);
    expect(xmlEscape(`A&B < "C"`)).toBe("A&amp;B &lt; &quot;C&quot;");
    expect(freshStories([{ publishedAt: "2026-11-22T12:00:00.000Z" }], Date.parse("2026-11-23T12:00:00.000Z"))).toHaveLength(1);
    expect(freshStories([{ publishedAt: "2026-11-16T12:00:00.000Z" }], Date.parse("2026-11-23T12:00:00.000Z"))).toHaveLength(0);
    expect(stories.length).toBeLessThanOrEqual(THRESHOLDS.cap);
  });
});
