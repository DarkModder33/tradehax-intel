import { describe, expect, it } from "vitest";
import {
  flippedSymbols,
  freshnessLabel,
  readPopoutMessage,
  regimeLabel,
  snapshotCovers,
  snapshotIsFresh,
} from "./channel";
import { DEFAULT_POPOUT, mergePopoutPrefs, normalizePopoutPrefs, popoutPath, readPopoutPrefs, resolveVisit, writePopoutPrefs } from "./prefs";

describe("pop-out preferences", () => {
  it("builds the static fallback route", () => {
    expect(popoutPath({ symbols: ["SPY", "NVDA"], timeframe: "5m" })).toBe(
      "/popout/?symbols=SPY,NVDA&tf=5m",
    );
  });

  it("lets a new link override stored symbols and timeframe, and leaves sound off", () => {
    const stored = { symbols: ["AAPL"], timeframe: "1d" as const, sound: false };
    expect(mergePopoutPrefs(stored, "?symbols=SPY,NVDA&tf=5m")).toEqual({
      symbols: ["SPY", "NVDA"],
      timeframe: "5m",
      sound: false,
    });
    expect(resolveVisit({ prefs: stored, appliedSearch: "" }, "?symbols=SPY,NVDA&tf=5m").prefs.timeframe).toBe("5m");
  });

  it("keeps the saved timeframe when the same link is opened again", () => {
    const search = "?symbols=SPY,NVDA&tf=5m";
    const saved = { symbols: ["SPY", "NVDA"], timeframe: "15m" as const, sound: false };
    expect(resolveVisit({ prefs: saved, appliedSearch: search }, search).prefs).toEqual(saved);
  });

  it("remembers a sound opt-in and drops junk tickers", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    };
    writePopoutPrefs(storage, { symbols: ["spy", "nope!", "QQQ"], timeframe: "1h", sound: true });
    expect(readPopoutPrefs(storage)).toEqual({ symbols: ["SPY", "QQQ"], timeframe: "1h", sound: true });
    expect(readPopoutPrefs({ getItem: () => null }).sound).toBe(false);
    expect(DEFAULT_POPOUT.sound).toBe(false);
  });

  it("allows an explicit empty symbol list", () => {
    expect(normalizePopoutPrefs({ symbols: [], timeframe: "15m", sound: false }).symbols).toEqual([]);
  });
});

describe("pop-out feed", () => {
  it("accepts a snapshot only when it covers every requested symbol and is still fresh", () => {
    const payload = { quotes: [{ symbol: "SPY" }], errors: [{ symbol: "NVDA" }] };
    expect(snapshotCovers(payload, ["SPY", "NVDA"])).toBe(true);
    expect(snapshotCovers(payload, ["SPY", "AAPL"])).toBe(false);
    expect(snapshotIsFresh(1_000, 20_000, 25_000)).toBe(true);
    expect(snapshotIsFresh(1_000, 60_000, 25_000)).toBe(false);
  });

  it("flags a direction flip and ignores the first time a symbol appears", () => {
    expect(flippedSymbols({ SPY: "bullish", NVDA: "bearish" }, { SPY: "bearish", NVDA: "bearish", AAPL: "bullish" })).toEqual([
      "SPY",
    ]);
  });

  it("reads channel messages and ignores junk", () => {
    expect(readPopoutMessage({ type: "prefs", prefs: { symbols: ["iwm"], timeframe: "4h", sound: false } })?.type).toBe("prefs");
    expect(readPopoutMessage({ type: "nope" })).toBeNull();
  });

  it("labels regime and freshness for the compact strip", () => {
    expect(regimeLabel("mixed", 19.3)).toBe("Mixed tape · VIX 19.3");
    expect(regimeLabel(null, null)).toBe("Regime unavailable");
    expect(freshnessLabel("agrees", "12s ago")).toBe("Yahoo Finance · 12s ago");
    expect(freshnessLabel("demo", "just now")).toBe("Demo data · just now");
    expect(freshnessLabel("disagrees", "6s ago")).toBe("Sources differ · 6s ago");
  });
});
