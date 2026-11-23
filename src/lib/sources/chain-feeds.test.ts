import { describe, expect, it } from "vitest";
import { CBOE_BROWSER_HEADERS, fetchWithRetry, parseAlpacaOptionSnapshots, parseYahooOptions, resolveChain } from "./chain-feeds";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("option chain feeds", () => {
  it("sends browser headers and retries a Cboe 403", async () => {
    expect(CBOE_BROWSER_HEADERS.referer).toBe("https://www.cboe.com/");
    expect(CBOE_BROWSER_HEADERS["user-agent"]).toContain("Chrome");
    const calls: string[] = [];
    let tries = 0;
    const fetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(url));
      const headers = init?.headers as Record<string, string>;
      expect(headers.referer).toBe("https://www.cboe.com/");
      tries += 1;
      if (tries < 3) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({
        timestamp: "2026-11-23 16:00:00",
        data: {
          symbol: "SPY",
          current_price: 500,
          options: [{ option: "SPY261218C00500000", bid: 1, ask: 1.2, iv: 0.2, delta: 0.4, gamma: 0.01, open_interest: 10, volume: 3, last_trade_price: 1.1 }],
        },
      });
    };
    const response = await fetchWithRetry("https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json", { headers: CBOE_BROWSER_HEADERS }, fetcher as typeof fetch, 3, async () => {});
    expect(response.ok).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it("maps Alpaca greeks and falls back when Cboe is forbidden", async () => {
    const parsed = parseAlpacaOptionSnapshots(
      {
        snapshots: {
          SPY261218C00500000: {
            latestQuote: { bp: 1.1, ap: 1.3 },
            latestTrade: { p: 1.2, s: 4, t: "2026-11-23T16:00:00Z" },
            impliedVolatility: 0.21,
            greeks: { delta: 0.42, gamma: 0.02, theta: -0.03, vega: 0.11, rho: 0.01 },
            openInterest: 80,
          },
        },
      },
      "SPY",
      500,
    );
    expect(parsed?.source).toBe("Alpaca indicative");
    expect(parsed?.contracts[0]).toMatchObject({ strike: 500, delta: 0.42, iv: 0.21, openInterest: 80, bid: 1.1 });
    const fetcher = async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("cdn.cboe.com")) return jsonResponse({}, 403);
      if (href.includes("/v2/stocks/")) return jsonResponse({ latestTrade: { p: 501 } });
      if (href.includes("/options/snapshots/")) {
        return jsonResponse({
          snapshots: {
            SPY261218P00490000: { latestQuote: { bp: 2, ap: 2.2 }, latestTrade: { p: 2.1 }, impliedVolatility: 0.3, greeks: { delta: -0.4, gamma: 0.01, theta: -0.01, vega: 0.1, rho: 0 } },
          },
        });
      }
      throw new Error(href);
    };
    const chain = await resolveChain("SPY", {
      fetcher: fetcher as typeof fetch,
      alpacaHeaders: { "APCA-API-KEY-ID": "k", "APCA-API-SECRET-KEY": "s" },
      sleep: async () => {},
    });
    expect(chain.source).toBe("Alpaca indicative");
    expect(chain.spot).toBe(501);
    expect(chain.contracts[0].right).toBe("put");
  });

  it("uses Yahoo when Cboe and Alpaca have no chain", async () => {
    const yahoo = parseYahooOptions(
      {
        optionChain: {
          result: [{
            quote: { regularMarketPrice: 100, regularMarketVolume: 10 },
            options: [{ calls: [{ contractSymbol: "ZZ261218C00100000", strike: 100, bid: 1, ask: 1.2, lastPrice: 1.1, impliedVolatility: 0.25, openInterest: 12, volume: 3 }], puts: [] }],
          }],
        },
      },
      "ZZ",
    );
    expect(yahoo?.source).toBe("Yahoo options");
    expect(yahoo?.spot).toBe(100);
    const fetcher = async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("cdn.cboe.com")) return jsonResponse({}, 403);
      if (href.includes("query1.finance.yahoo.com")) {
        return jsonResponse({
          optionChain: {
            result: [{
              quote: { regularMarketPrice: 100 },
              options: [{ calls: [{ contractSymbol: "ZZ261218C00100000", strike: 100, bid: 1, ask: 1.1, lastPrice: 1, impliedVolatility: 0.2, openInterest: 5, volume: 1 }], puts: [] }],
            }],
          },
        });
      }
      throw new Error(href);
    };
    const chain = await resolveChain("ZZ", { fetcher: fetcher as typeof fetch, alpacaHeaders: null, sleep: async () => {} });
    expect(chain.source).toBe("Yahoo options");
  });
});
