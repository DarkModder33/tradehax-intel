/** Static export cannot have a real /t/NVDA/ path for every symbol. The shell reads ?s= or #NVDA. */
export function tickerPath(symbol: string): string {
  return `/t/?s=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function chartPath(symbol: string, timeframe = "1d"): string {
  return `/chart/?s=${encodeURIComponent(symbol.toUpperCase())}&tf=${timeframe}`;
}

export const TICKER_TABS = ["overview", "chart", "options", "flow", "filings", "shorts", "earnings"] as const;
export type TickerTab = (typeof TICKER_TABS)[number];

export function readTickerTab(search: string): TickerTab {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("tab");
  return TICKER_TABS.includes(raw as TickerTab) ? (raw as TickerTab) : "overview";
}

export function tickerTabPath(symbol: string, tab: TickerTab = "overview"): string {
  const base = tickerPath(symbol);
  return tab === "overview" ? base : `${base}&tab=${tab}`;
}

export function readTicker(search: string, hash: string, fallback = "SPY"): string {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("s");
  const fromHash = hash.replace(/^#/, "");
  const raw = (query || fromHash || fallback).trim().toUpperCase();
  return /^[A-Z][A-Z0-9.]{0,9}$/.test(raw) ? raw : fallback;
}
