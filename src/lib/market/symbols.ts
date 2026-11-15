export const DEFAULT_WATCHLIST = ["SPY", "QQQ", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMD"] as const;

export const MAX_SYMBOLS = 12;

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;

export function normalizeSymbol(input: string): string | null {
  const symbol = input.trim().toUpperCase();
  return SYMBOL_PATTERN.test(symbol) ? symbol : null;
}

/** Drop blanks, duplicates, and anything that is not a ticker. Caps the list. */
export function sanitizeSymbols(inputs: string[]): string[] {
  const unique: string[] = [];
  for (const input of inputs) {
    const symbol = normalizeSymbol(input);
    if (!symbol || unique.includes(symbol)) continue;
    unique.push(symbol);
    if (unique.length >= MAX_SYMBOLS) break;
  }
  return unique;
}

/** Query-string parser. An empty or fully invalid value falls back to the default watchlist. */
export function parseSymbols(value: string | null): string[] {
  if (!value || !value.trim()) return [...DEFAULT_WATCHLIST];
  const parsed = sanitizeSymbols(value.split(","));
  return parsed.length > 0 ? parsed : [...DEFAULT_WATCHLIST];
}
