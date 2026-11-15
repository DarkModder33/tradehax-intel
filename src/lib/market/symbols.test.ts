import { describe, expect, it } from "vitest";
import { DEFAULT_WATCHLIST, MAX_SYMBOLS, parseSymbols, sanitizeSymbols } from "./symbols";

describe("symbols", () => {
  it("normalizes a watchlist and drops junk", () => {
    expect(sanitizeSymbols([" nvda ", "SPY", "nope!", "BRK.B", "123", "nvda"])).toEqual([
      "NVDA",
      "SPY",
      "BRK.B",
    ]);
  });

  it("falls back to the default list when the query is empty or invalid", () => {
    expect(parseSymbols(null)).toEqual([...DEFAULT_WATCHLIST]);
    expect(parseSymbols("!!!")).toEqual([...DEFAULT_WATCHLIST]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, index) => `A${index}`);
    expect(sanitizeSymbols(many)).toHaveLength(MAX_SYMBOLS);
  });
});
