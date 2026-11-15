import { describe, expect, it } from "vitest";
import { MarketDataError } from "./provider";
import { parseYahooChart, yahooChartRequestUrl } from "./yahoo";

describe("yahooChartRequestUrl", () => {
  it("routes Yahoo through the keyless browser proxy and does not embed a secret", () => {
    const url = yahooChartRequestUrl("BRK.B", "15m", "5d");
    expect(url.startsWith("https://proxy.cors.dev/https://query1.finance.yahoo.com/v8/finance/chart/BRK-B?")).toBe(
      true,
    );
    expect(url).toContain("interval=15m");
    expect(url).toContain("range=5d");
    expect(url.toLowerCase()).not.toMatch(/apikey|api_key|token|secret|authorization/);
  });
});

describe("parseYahooChart", () => {
  it("keeps valid bars, skips nulls, and drops a trailing zero-volume print", () => {
    const parsed = parseYahooChart(
      {
        chart: {
          result: [
            {
              timestamp: [100, 160, 220],
              indicators: {
                quote: [
                  {
                    open: [1, null, 2],
                    high: [1.5, 2, 2.4],
                    low: [0.8, 1.2, 1.9],
                    close: [1.2, 1.8, 2.2],
                    volume: [10, 4, 0],
                  },
                ],
              },
              meta: {
                regularMarketPrice: 2.2,
                previousClose: 1,
                currency: "USD",
                regularMarketTime: 220,
              },
            },
          ],
          error: null,
        },
      },
      "AAPL",
    );

    expect(parsed.bars).toEqual([
      { time: 100_000, open: 1, high: 1.5, low: 0.8, close: 1.2, volume: 10 },
    ]);
    expect(parsed.quote.price).toBe(2.2);
    expect(parsed.quote.changePercent).toBeCloseTo(120, 6);
    expect(parsed.quote.asOf).toBe(220_000);
    expect(parsed.quote.symbol).toBe("AAPL");
  });

  it("surfaces a Yahoo error without throwing a raw payload", () => {
    expect(() =>
      parseYahooChart(
        { chart: { result: null, error: { description: "No data found, symbol may be delisted" } } },
        "NOPE",
      ),
    ).toThrow(MarketDataError);
  });
});
