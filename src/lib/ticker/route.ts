/** Static export cannot have a real /t/NVDA/ path for every symbol. The shell reads ?s= or #NVDA. */
export function tickerPath(symbol: string): string {
  return `/t/?s=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function readTicker(search: string, hash: string, fallback = "SPY"): string {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("s");
  const fromHash = hash.replace(/^#/, "");
  const raw = (query || fromHash || fallback).trim().toUpperCase();
  return /^[A-Z][A-Z0-9.]{0,9}$/.test(raw) ? raw : fallback;
}
