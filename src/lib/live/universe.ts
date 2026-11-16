/** Liquid ETFs, mega caps, and names that usually carry listed option premium. BRK.B is BRKB on Cboe. */
export const DEFAULT_UNIVERSE = [
  "SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLB", "XLU", "XLRE", "XLC", "GLD", "TLT", "HYG", "SMH",
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRKB",
  "JPM", "V", "UNH", "XOM", "LLY", "MA", "COST", "HD", "PG", "JNJ",
  "BAC", "AMD", "NFLX", "CRM", "ORCL", "KO", "WMT", "CVX", "MRK", "ABBV", "PLTR", "COIN", "MSTR", "BA",
] as const;

export function parseUniverse(raw: string | undefined, fallback = DEFAULT_UNIVERSE.join(",")): string[] {
  return (raw && raw.trim() ? raw : fallback)
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z][A-Z0-9.]{0,9}$/.test(symbol));
}

export function rotatingSlice(symbols: string[], cursor: number, size: number): { batch: string[]; next: number } {
  if (symbols.length === 0) return { batch: [], next: 0 };
  const batch: string[] = [];
  for (let index = 0; index < Math.min(size, symbols.length); index++) {
    batch.push(symbols[(cursor + index) % symbols.length]);
  }
  return { batch, next: (cursor + batch.length) % symbols.length };
}
