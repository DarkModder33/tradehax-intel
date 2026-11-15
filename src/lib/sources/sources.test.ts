import { describe, expect, it } from "vitest";
import { memoryCache } from "./cache";
import { cboeChainRequestUrl, parseCboeChain } from "./cboe";
import { parseFinraShortVolume, shortVolumeRatio } from "./finra";
import { datasetUrl, emptyDataset } from "./manifest";
import { isStandardContract, parseOcc } from "./occ";
import { healthBody, workerConnected } from "../live/worker";

describe("OCC symbols", () => {
  it("parses a standard contract and rejects an adjusted B1 root", () => {
    expect(parseOcc("SPY261120C00710000")).toEqual({
      symbol: "SPY261120C00710000",
      root: "SPY",
      expiry: "2026-11-20",
      right: "call",
      strike: 710,
    });
    expect(parseOcc("B1SPY261120C00710000")).toBeNull();
    expect(isStandardContract("SPY261116P00750000", "SPY")).toBe(true);
    expect(isStandardContract("B1SPY261120C00710000", "SPY")).toBe(false);
  });
});

describe("Cboe chain", () => {
  it("keeps the standard root and records the delayed source", () => {
    const chain = parseCboeChain(
      {
        timestamp: "2026-11-14 23:57:55",
        data: {
          symbol: "SPY",
          current_price: 754.37,
          iv30: 14.874,
          options: [
            { option: "SPY261116C00775000", bid: 1, ask: 1.1, iv: 0.12, delta: 0.4, gamma: 0.01, open_interest: 10, volume: 3, last_trade_price: 1.05 },
            { option: "B1SPY261116C00775000", open_interest: 99, gamma: 1, volume: 99 },
          ],
        },
      },
      "SPY",
    );
    expect(chain.contracts).toHaveLength(1);
    expect(chain.contracts[0].strike).toBe(775);
    expect(chain.spot).toBe(754.37);
    expect(chain.source).toBe("Cboe delayed");
    expect(cboeChainRequestUrl("spy")).toBe(
      "https://proxy.cors.dev/https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json",
    );
  });
});

describe("FINRA short volume", () => {
  it("parses the daily pipe file", () => {
    const rows = parseFinraShortVolume(
      "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n20261113|SPY|100|5|250|Q\n",
    );
    expect(rows[0]).toMatchObject({ date: "2026-11-13", symbol: "SPY", shortVolume: 100, totalVolume: 250, market: "Q" });
    expect(shortVolumeRatio(rows[0])).toBeCloseTo(0.4);
  });
});

describe("manifest and worker presence", () => {
  it("builds static data urls and an unavailable dataset", () => {
    expect(datasetUrl("manifest.json")).toBe("/tradehax-intel/data/manifest.json");
    expect(emptyDataset("SEC", "timed out").unavailable).toBe(true);
  });

  it("points at the public worker unless the URL is turned off", () => {
    expect(workerConnected()).toBe(true);
    expect(healthBody("2026-11-15T00:00:00.000Z").ok).toBe(true);
  });

  it("expires memory cache entries", async () => {
    let now = 1_000;
    const cache = memoryCache(() => now);
    await cache.set("spy", "chain", 50);
    expect(await cache.get("spy")).toBe("chain");
    now = 1_060;
    expect(await cache.get("spy")).toBeNull();
  });
});
