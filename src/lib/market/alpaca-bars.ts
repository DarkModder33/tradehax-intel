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

/** Regular-session bars. Alpaca's limit is the newest rows once sort=desc is set. */
export function barsPerSession(timeframe: BarTimeframe): number {
  switch (timeframe) {
    case "1Min":
      return 390;
    case "5Min":
      return 78;
    case "15Min":
      return 26;
    case "1Hour":
      return 7;
    case "1Day":
      return 1;
  }
}

/** Calendar days of history, padded 1.6x for weekends and holidays. */
export function lookbackDays(timeframe: BarTimeframe, limit: number): number {
  const sessions = Math.ceil(clampBarLimit(limit) / barsPerSession(timeframe));
  return Math.max(1, Math.ceil(sessions * 1.6));
}

export function barsStart(timeframe: BarTimeframe, limit: number, now = new Date()): string {
  const start = new Date(now.getTime() - lookbackDays(timeframe, limit) * 86_400_000);
  return start.toISOString();
}

/** Cboe lists Berkshire as BRKB. Alpaca's SIP symbol is BRK.B. */
export function alpacaSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === "BRKB" || upper === "BRK-B" || upper === "BRK/B") return "BRK.B";
  return upper;
}

/** Same name on Yahoo's chart host. */
export function yahooVendorSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === "BRKB" || upper === "BRK.B" || upper === "BRK/B") return "BRK-B";
  return upper.replace(/\./g, "-");
}

/** Site and Cboe key. Alpaca's BRK.B comes back as BRKB. */
export function canonicalSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === "BRK.B" || upper === "BRK-B" || upper === "BRK/B" || upper === "BRKB") return "BRKB";
  return upper;
}

export interface MultiBarsOptions {
  now?: Date;
  pageToken?: string;
}

const MULTI_PAGE_CAP = 10_000;

/** Alpaca SIP stock bars. The worker calls this. The browser never sees the keys. `end` stays unset. */
export function multiBarsUrl(symbols: string[], perSymbol = 260, options: MultiBarsOptions = {}): string {
  const mapped = symbols.map(alpacaSymbol);
  const each = clampBarLimit(perSymbol);
  // The multi-symbol limit counts bars across the whole page, not per name.
  const pageLimit = Math.min(MULTI_PAGE_CAP, Math.max(each, mapped.length * each));
  const params = new URLSearchParams({
    symbols: mapped.join(","),
    timeframe: "1Day",
    start: barsStart("1Day", each, options.now ?? new Date()),
    limit: String(pageLimit),
    sort: "desc",
    adjustment: "split",
    feed: "sip",
  });
  if (options.pageToken) params.set("page_token", options.pageToken);
  return `https://data.alpaca.markets/v2/stocks/bars?${params}`;
}

export function stockBarsUrl(symbol: string, timeframe: BarTimeframe, limit: number, now = new Date()): string {
  const params = new URLSearchParams({
    timeframe,
    start: barsStart(timeframe, limit, now),
    limit: String(clampBarLimit(limit)),
    sort: "desc",
    adjustment: "split",
    feed: "sip",
  });
  return `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(alpacaSymbol(symbol))}/bars?${params}`;
}

export function readPageToken(payload: unknown): string | null {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return typeof body.next_page_token === "string" && body.next_page_token ? body.next_page_token : null;
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
    const wanted = symbol ? canonicalSymbol(symbol) : "";
    const key = symbol
      ? Object.keys(book).find((item) => canonicalSymbol(item) === wanted || item.toUpperCase() === symbol.toUpperCase())
      : Object.keys(book)[0];
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
  // sort=desc delivers the newest bar first. Flip that so callers see oldest first, then keep the newest window.
  if (bars.length > 1 && bars[0].time > bars[bars.length - 1].time) bars.reverse();
  else bars.sort((a, b) => a.time - b.time);
  return bars.slice(-MAX_BARS);
}

function barsBook(payload: unknown): Record<string, unknown[]> {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  if (!body.bars || typeof body.bars !== "object" || Array.isArray(body.bars)) return {};
  const book: Record<string, unknown[]> = {};
  for (const [key, list] of Object.entries(body.bars as Record<string, unknown>)) {
    if (Array.isArray(list)) book[key] = list;
  }
  return book;
}

/**
 * Merge paged multi-symbol responses. Pages are newest-first. Each symbol keeps its most recent `target` bars, oldest first.
 */
export function mergeBarPages(pages: unknown[], symbols: string[], target: number): Record<string, Bar[]> {
  const wanted = new Set(symbols.map(canonicalSymbol));
  const buckets = new Map<string, Bar[]>();
  for (const symbol of wanted) buckets.set(symbol, []);
  for (const page of pages) {
    for (const [key, list] of Object.entries(barsBook(page))) {
      const symbol = canonicalSymbol(key);
      if (wanted.size && !wanted.has(symbol)) continue;
      const dest = buckets.get(symbol) ?? [];
      dest.push(...parseAlpacaBars({ bars: list }));
      buckets.set(symbol, dest);
    }
  }
  const out: Record<string, Bar[]> = {};
  const keep = Math.min(Math.max(1, Math.floor(target) || 1), MAX_BARS);
  for (const [symbol, bars] of buckets) {
    const sorted = bars.slice().sort((a, b) => a.time - b.time);
    const deduped: Bar[] = [];
    for (const bar of sorted) {
      if (!deduped.length || deduped[deduped.length - 1].time !== bar.time) deduped.push(bar);
    }
    out[symbol] = deduped.slice(-keep);
  }
  return out;
}
