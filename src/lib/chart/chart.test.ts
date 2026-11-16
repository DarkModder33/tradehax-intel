import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { atr } from "@/lib/indicators/atr";
import { bollinger } from "@/lib/indicators/bollinger";
import { obv } from "@/lib/indicators/obv";
import { sma } from "@/lib/indicators/sma";
import { stoch } from "@/lib/indicators/stoch";
import { flowMarkerColor, flowMarkers, gexPriceLines, markerSize } from "./overlays";
import { parseChartQuery, serializeChartQuery } from "./url-state";
import type { ChainSummary } from "@/lib/options/summary";
import type { FlowPrint } from "@/lib/flow/classify";

function bar(partial: Partial<Bar> & Pick<Bar, "close">): Bar {
  return { time: 0, open: partial.close, high: partial.close, low: partial.close, volume: 1, ...partial };
}

describe("chart indicators", () => {
  it("matches hand Bollinger, Wilder ATR, and stochastic values", () => {
    const closes = [1, 2, 3, 4, 5];
    expect(sma(closes, 3)).toEqual([null, null, 2, 3, 4]);
    const bands = bollinger(closes, 3, 2);
    const deviation = Math.sqrt((1 + 0 + 1) / 3);
    expect(bands[2].middle).toBe(2);
    expect(bands[2].upper).toBeCloseTo(2 + 2 * deviation, 8);
    expect(bands[2].lower).toBeCloseTo(2 - 2 * deviation, 8);

    const bars: Bar[] = [
      bar({ time: 1, high: 10, low: 8, close: 9 }),
      bar({ time: 2, high: 11, low: 9, close: 10 }),
      bar({ time: 3, high: 12, low: 8, close: 9 }),
      bar({ time: 4, high: 13, low: 11, close: 12 }),
    ];
    const width = atr(bars, 2);
    expect(width[1]).toBeCloseTo(2, 8);
    expect(width[2]).toBeCloseTo(3, 8);
    expect(width[3]).toBeCloseTo(3.5, 8);

    const stochBars: Bar[] = [
      bar({ time: 1, high: 12, low: 10, close: 11 }),
      bar({ time: 2, high: 14, low: 11, close: 12 }),
      bar({ time: 3, high: 13, low: 9, close: 10 }),
    ];
    const osc = stoch(stochBars, 3, 1);
    expect(osc[2].k).toBeCloseTo(((10 - 9) / (14 - 9)) * 100, 8);
    expect(osc[2].d).toBeCloseTo(osc[2].k ?? 0, 8);
    expect(obv([bar({ close: 1, volume: 10 }), bar({ close: 2, volume: 4 }), bar({ close: 1, volume: 3 })])).toEqual([0, 4, 1]);
  });
});

describe("chart url and overlays", () => {
  it("round-trips the chart query", () => {
    const query = parseChartQuery("?s=nvda&tf=1d&ind=ema20,rsi14&ov=gex,flow&cmp=QQQ&log=1&av=100");
    expect(query).toMatchObject({
      symbol: "NVDA",
      timeframe: "1d",
      indicators: ["ema20", "rsi14"],
      overlays: ["gex", "flow"],
      compare: "QQQ",
      log: true,
      anchor: 100,
    });
    expect(parseChartQuery(`?${serializeChartQuery(query)}`)).toEqual(query);
  });

  it("maps gamma levels to labelled price lines", () => {
    const summary = {
      levels: { callWall: 600, putWall: 520, flip: 560, flips: [], netGex: 0, dex: 0, vex: 0, chex: 0, magnet: null, regime: "flat" },
      maxPain: 540,
      expectedMove: { high: 610, low: 490, dollars: 60, percent: 0.1, expiry: "2026-12-18", strike: 550 },
    } as unknown as ChainSummary;
    const titles = gexPriceLines(summary).map((line) => line.title);
    expect(titles[0]).toBe("Call wall 600");
    expect(titles).toContain("Put wall 520");
    expect(titles.some((title) => title.startsWith("+1σ"))).toBe(true);
  });

  it("colours flow markers by side and buckets the premium", () => {
    expect(flowMarkerColor({ right: "call", side: "ASK" })).toContain("155");
    expect(flowMarkerColor({ right: "put", side: "BID" })).toContain("155");
    expect(flowMarkerColor({ right: "call", side: "BID" })).toContain("22");
    expect(flowMarkerColor({ right: "put", side: "ASK" })).toContain("22");
    expect(flowMarkerColor({ right: "call", side: "MID" })).toBeNull();
    expect(markerSize(200_000)).toBe(1);
    expect(markerSize(250_000)).toBe(1.4);
    expect(markerSize(1_000_000)).toBe(2);
    expect(markerSize(5_000_000)).toBe(3);
    const print = {
      time: "2026-11-14T15:00:00Z",
      contract: "NVDA261218C00200000",
      root: "NVDA",
      expiry: "2026-12-18",
      strike: 200,
      right: "call",
      side: "ASK",
      size: 10,
      price: 5,
      premium: 1_000_000,
      delta: 0.4,
      conditions: [],
      inferred: true,
      sentiment: "bullish",
      flags: [],
    } satisfies FlowPrint;
    const marker = flowMarkers([print])[0];
    expect(marker.size).toBe(2);
    expect(marker.tooltip).toContain("INFERRED");
    expect(marker.inferred).toBe(true);
  });
});
