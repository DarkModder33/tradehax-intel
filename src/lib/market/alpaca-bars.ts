import type { Bar } from "@/lib/indicators/types";

export const BAR_TIMEFRAMES = ["1Min", "5Min", "15Min", "1Hour", "1Day"] as const;
export type BarTimeframe = (typeof BAR_TIMEFRAMES)[number];
export const MAX_BARS = 2500;

export function isBarTimeframe(value: string | null | undefined): value is BarTimeframe {
  return BAR_TIMEFRAMES.includes(value as BarTimeframe);
}

export function clampBarLimit(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 300;
  return Math.min(Math.floor(raw), MAX_BARS);
}

/** Alpaca SIP stock bars. The worker calls this. The browser never sees the keys. */
export function multiBarsUrl(symbols: string[], limit = 260): string {
  const params = new URLSearchParams({
    symbols: symbols.map((symbol) => symbol.toUpperCase()).join(","),
    timeframe: "1Day",
    limit: String(clampBarLimit(limit)),
    adjustment: "split",
    feed: "sip",
  });
  return `https://data.alpaca.markets/v2/stocks/bars?${params}`;
}

export function stockBarsUrl(symbol: string, timeframe: BarTimeframe, limit: number): string {
  const params = new URLSearchParams({
    timeframe,
    limit: String(clampBarLimit(limit)),
    adjustment: "split",
    feed: "sip",
  });
  return `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol.toUpperCase())}/bars?${params}`;
}

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

/** Accepts the single-symbol `{ bars: [] }` shape and the multi-symbol `{ bars: { SYM: [] } }` shape. */
export function parseAlpacaBars(payload: unknown, symbol?: string): Bar[] {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  let rows: unknown[] = [];
  if (Array.isArray(body.bars)) rows = body.bars;
  else if (body.bars && typeof body.bars === "object") {
    const book = body.bars as Record<string, unknown>;
    const key = symbol ? Object.keys(book).find((item) => item.toUpperCase() === symbol.toUpperCase()) : Object.keys(book)[0];
    const list = key ? book[key] : undefined;
    if (Array.isArray(list)) rows = list;
  }
  const bars: Bar[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const time = typeof raw.t === "string" ? Date.parse(raw.t) : finite(raw.t);
    const open = finite(raw.o);
    const high = finite(raw.h);
    const low = finite(raw.l);
    const close = finite(raw.c);
    const volume = finite(raw.v);
    if (time == null || open == null || high == null || low == null || close == null || volume == null) continue;
    bars.push({ time, open, high, low, close, volume });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars.slice(-MAX_BARS);
}
