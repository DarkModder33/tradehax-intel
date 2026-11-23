import { describe, expect, it } from "vitest";
import { CBOE_BROWSER_HEADERS, fromAlpacaSnapshots, loadOptionChain, nearestIv30 } from "../../../scripts/data/option-chain.mjs";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("nightly option chain fallback", () => {
  it("retries Cboe with browser headers before Alpaca", async () => {
    const hits: string[] = [];
    let cboe = 0;
    const fetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      hits.push(href);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (href.includes("cdn.cboe.com")) {
        expect(headers.referer).toBe("https://www.cboe.com/");
        expect(headers["user-agent"]).toBe(CBOE_BROWSER_HEADERS["user-agent"]);
        cboe += 1;
        return jsonResponse({}, 403);
      }
      if (href.includes("/v2/stocks/BRK.B/")) return jsonResponse({ latestTrade: { p: 420 } });
      if (href.includes("/options/snapshots/BRK.B")) {
        return jsonResponse({
          snapshots: {
            BRKB261218C00420000: { latestQuote: { bp: 3, ap: 3.2 }, latestTrade: { p: 3.1 }, impliedVolatility: 0.18, greeks: { delta: 0.5, gamma: 0.01 }, openInterest: 40 },
          },
        });
      }
      throw new Error(href);
    };
    const body = await loadOptionChain("BRKB", { fetcher, alpacaKey: "k", alpacaSecret: "s", sleep: async () => {} });
    expect(cboe).toBe(3);
    expect(body.source).toBe("Alpaca indicative");
    expect(body.data.current_price).toBe(420);
    expect(body.data.options[0].open_interest).toBe(40);
    expect(hits.some((href) => href.includes("BRK.B"))).toBe(true);
  });

  it("derives a 30-day IV from the mapped chain", () => {
    const mapped = fromAlpacaSnapshots(
      { snapshots: { SPY261218C00500000: { impliedVolatility: 0.22, latestQuote: { bp: 1, ap: 1.1 }, latestTrade: { p: 1 } } } },
      "SPY",
      500,
    );
    expect(nearestIv30(mapped?.data.options, 500, Date.parse("2026-11-23T00:00:00Z"))).toBe(0.22);
  });
});
