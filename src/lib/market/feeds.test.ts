import { describe, expect, it } from "vitest";
import { memoryCache } from "@/lib/sources/cache";
import { fetchChain, parseChainOffThread, setChainCache } from "@/lib/sources/cboe";
import { cacheFromStore } from "@/lib/sources/idb-cache";
import { fetchChainSummary } from "@/lib/options/load-summary";
import { summarizeChain } from "@/lib/options/summary";
import type { ChainSnapshot } from "@/lib/sources/cboe";
import { clampBarLimit, lookbackDays, mergeBarPages, multiBarsUrl, parseAlpacaBars, readPageToken, stockBarsUrl } from "./alpaca-bars";
import { fetchNews, parseNews, yahooNewsUpstream } from "./news";
import { fetchWorkerChart } from "./worker-bars";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const chain: ChainSnapshot = {
  symbol: "ZZ",
  spot: 100,
  iv30: 0.2,
  asOf: "2026-11-14 16:00:00",
  volume: 10,
  source: "Cboe delayed",
  delay: "about 15 min",
  contracts: [
    {
      symbol: "ZZ261220C00100000",
      root: "ZZ",
      expiry: "2026-12-20",
      right: "call",
      strike: 105,
      bid: 2,
      ask: 2.2,
      iv: 0.2,
      delta: 0.5,
      gamma: 0.02,
      vega: 0.1,
      theta: -0.01,
      rho: 0,
      theo: 2.1,
      openInterest: 50,
      volume: 5,
      last: 2.1,
      lastTradeTime: null,
    },
    {
      symbol: "ZZ261220P00095000",
      root: "ZZ",
      expiry: "2026-12-20",
      right: "put",
      strike: 95,
      bid: 1,
      ask: 1.2,
      iv: 0.22,
      delta: -0.3,
      gamma: 0.015,
      vega: 0.1,
      theta: -0.01,
      rho: 0,
      theo: 1.1,
      openInterest: 40,
      volume: 4,
      last: 1.1,
      lastTradeTime: null,
    },
  ],
};

describe("Alpaca bars", () => {
  const now = new Date("2026-11-16T15:00:00Z");

  it("asks for the recent window with start and newest-first order", () => {
    expect(clampBarLimit(9000)).toBe(2500);
    expect(lookbackDays("1Day", 100)).toBe(160);
    expect(lookbackDays("1Hour", 8)).toBe(4);
    const url = new URL(stockBarsUrl("spy", "1Day", 100, now));
    expect(url.pathname).toBe("/v2/stocks/SPY/bars");
    expect(url.searchParams.get("feed")).toBe("sip");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("sort")).toBe("desc");
    expect(url.searchParams.get("end")).toBeNull();
    expect(Date.parse(url.searchParams.get("start") ?? "")).toBe(now.getTime() - 160 * 86_400_000);
    const berkshire = new URL(stockBarsUrl("BRKB", "1Day", 10, now));
    expect(berkshire.pathname).toBe("/v2/stocks/BRK.B/bars");
  });

  it("reverses a descending page and merges later pages onto it", () => {
    const single = parseAlpacaBars({
      bars: [
        { t: "2026-11-14T15:00:00Z", o: 2, h: 2, l: 2, c: 2, v: 2 },
        { t: "2026-11-14T14:30:00Z", o: 1, h: 2, l: 0.5, c: 1.5, v: 10 },
        { t: "bad" },
      ],
    });
    expect(single.map((bar) => bar.close)).toEqual([1.5, 2]);
    const newer = { t: "2026-11-14T15:00:00Z", o: 3, h: 4, l: 2, c: 3, v: 8 };
    const older = { t: "2026-11-13T15:00:00Z", o: 2, h: 3, l: 1, c: 2, v: 8 };
    const oldest = { t: "2026-11-12T15:00:00Z", o: 1, h: 2, l: 1, c: 1, v: 8 };
    const first = { bars: { "BRK.B": [newer, older], SPY: [newer] }, next_page_token: "page-2" };
    const second = { bars: { "BRK.B": [oldest] }, next_page_token: null };
    expect(readPageToken(first)).toBe("page-2");
    const merged = mergeBarPages([first, second], ["BRKB", "SPY"], 10);
    expect(merged.BRKB.map((bar) => bar.close)).toEqual([1, 2, 3]);
    expect(merged.SPY.map((bar) => bar.close)).toEqual([3]);
    const multi = new URL(multiBarsUrl(["BRKB", "SPY"], 260, { now, pageToken: "page-2" }));
    expect(multi.searchParams.get("symbols")).toBe("BRK.B,SPY");
    expect(multi.searchParams.get("sort")).toBe("desc");
    expect(multi.searchParams.get("page_token")).toBe("page-2");
    expect(multi.searchParams.get("end")).toBeNull();
    expect(multi.searchParams.get("start")).toBe(barsStartForTest());
  });
});

function barsStartForTest(): string {
  return new Date(Date.parse("2026-11-16T15:00:00Z") - 416 * 86_400_000).toISOString();
}

describe("chain summary and shared cache", () => {
  it("builds a compact book and ignores the proxy when the worker answers", async () => {
    const summary = summarizeChain(chain, new Date("2026-11-14T21:00:00Z"));
    expect(summary.levels.callWall).toBe(105);
    expect(summary.levels.putWall).toBe(95);
    expect(summary.expectedMove?.low).toBeLessThan(summary.spot);
    expect(JSON.stringify(summary).length).toBeLessThan(20_000);

    const calls: string[] = [];
    const fetcher = async (url: RequestInfo | URL) => {
      const href = String(url);
      calls.push(href);
      if (href.includes("proxy.cors.dev")) throw new Error("proxy down");
      if (href.includes("/v1/chain-summary/")) return response(summary);
      throw new Error(href);
    };
    const loaded = await fetchChainSummary("ZZ", fetcher);
    expect(loaded.symbol).toBe("ZZ");
    expect(calls.some((href) => href.includes("proxy.cors.dev"))).toBe(false);
    expect(loaded.levels.putWall).toBe(95);
  });

  it("fetches a chain once and parses without a worker on the main thread", async () => {
    setChainCache(memoryCache());
    let calls = 0;
    const fetcher = async (url: RequestInfo | URL) => {
      calls += 1;
      const href = String(url);
      if (href.includes("/v1/chain/")) return response({ snapshot: chain });
      throw new Error("proxy should not run");
    };
    const first = await fetchChain("ZZCACHE", fetcher);
    const second = await fetchChain("ZZCACHE", fetcher);
    expect(first.spot).toBe(100);
    expect(second.contracts).toHaveLength(2);
    expect(calls).toBe(1);
    const parsed = await parseChainOffThread(
      { data: { symbol: "ZZ", current_price: 10, options: [] } },
      "ZZ",
    );
    expect(parsed.spot).toBe(typeof Worker === "undefined" ? 10 : parsed.spot);
  });

  it("expires indexed-db records from the stored timestamp", async () => {
    let now = 1_000;
    const rows = new Map<string, string>();
    const cache = cacheFromStore(
      {
        async get(key) {
          return rows.get(key) ?? null;
        },
        async set(key, value) {
          rows.set(key, value);
        },
      },
      () => now,
    );
    await cache.set("chain:ZZ", "{\"spot\":1}", 60_000);
    expect(await cache.get("chain:ZZ")).toBe('{"spot":1}');
    now = 70_000;
    expect(await cache.get("chain:ZZ")).toBeNull();
  });
});

describe("news", () => {
  it("parses Yahoo headlines and prefers the worker", async () => {
    expect(yahooNewsUpstream("NVDA", 3)).toContain("query1.finance.yahoo.com");
    expect(parseNews({ news: [{ title: " Chip bid ", publisher: "Reuters", link: "https://example.com" }, { title: "" }] })).toEqual([
      { title: "Chip bid", publisher: "Reuters", url: "https://example.com" },
    ]);
    const calls: string[] = [];
    const fetcher = async (url: RequestInfo | URL) => {
      calls.push(String(url));
      if (String(url).includes("/v1/news")) return response({ news: [{ title: "From worker", publisher: "Desk" }] });
      throw new Error("proxy");
    };
    const loaded = await fetchNews("NVDA", 2, fetcher);
    expect(loaded.source).toBe("Yahoo Finance via worker");
    expect(loaded.items[0].title).toBe("From worker");
    expect(calls).toHaveLength(1);
  });
});

describe("worker bar fallback", () => {
  it("returns null when the worker has no bars so Yahoo can take over", async () => {
    const fetcher = async () => response({ error: "alpaca not configured" }, 503);
    expect(await fetchWorkerChart("SPY", "1d", "1y", fetcher)).toBeNull();
  });
});
