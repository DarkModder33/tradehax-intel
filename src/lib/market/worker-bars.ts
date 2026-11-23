import type { Bar } from "@/lib/indicators/types";
import type { Quote } from "@/lib/market/types";
import { workerConnected, workerUrl } from "@/lib/live/worker";
import { isBarTimeframe, type BarTimeframe } from "./alpaca-bars";

const INTERVAL_TF: Record<string, BarTimeframe> = {
  "1m": "1Min",
  "5m": "5Min",
  "15m": "15Min",
  "60m": "1Hour",
  "1h": "1Hour",
  "1d": "1Day",
};

export function limitForRange(interval: string, range: string): number {
  if (interval === "1d" && (range === "10y" || range === "max")) return 2500;
  if (interval === "1d" && range === "5y") return 1300;
  if (interval === "1d") return 320;
  if (interval === "60m" || interval === "1h") return 700;
  return 500;
}

export function quoteFromBars(symbol: string, bars: Bar[]): Quote {
  const last = bars[bars.length - 1];
  const previous = bars.length > 1 ? bars[bars.length - 2].close : null;
  return {
    symbol,
    price: last.close,
    previousClose: previous,
    changePercent: previous != null && previous !== 0 ? ((last.close - previous) / previous) * 100 : null,
    currency: "USD",
    asOf: last.time,
  };
}

const nyDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Day change against the prior session's daily close. Intraday bars only know the
 * previous bar, so a quote built from them measures a one-minute move; daily bars fix
 * the baseline. Returns the quote unchanged when no earlier session is available.
 */
export function withSessionChange(quote: Quote, daily: Bar[]): Quote {
  if (!Number.isFinite(quote.price) || daily.length === 0) return quote;
  const today = nyDay.format(new Date(quote.asOf || daily[daily.length - 1].time));
  for (let index = daily.length - 1; index >= 0; index -= 1) {
    const bar = daily[index];
    if (nyDay.format(new Date(bar.time)) >= today) continue;
    if (!Number.isFinite(bar.close) || bar.close === 0) return quote;
    return { ...quote, previousClose: bar.close, changePercent: ((quote.price - bar.close) / bar.close) * 100 };
  }
  return quote;
}

export function workerBarsUrl(symbol: string, timeframe: BarTimeframe, limit: number): string {
  const params = new URLSearchParams({ tf: timeframe, limit: String(limit) });
  return `${workerUrl()}/v1/bars/${encodeURIComponent(symbol.toUpperCase())}?${params}`;
}

/** Null when the worker is off, the timeframe is unknown, or the route does not answer. */
export async function fetchWorkerChart(
  symbol: string,
  interval: string,
  range: string,
  fetcher: typeof fetch = fetch,
): Promise<{ bars: Bar[]; quote: Quote } | null> {
  const timeframe = INTERVAL_TF[interval];
  if (!timeframe || !isBarTimeframe(timeframe) || !workerConnected()) return null;
  try {
    const response = await fetcher(workerBarsUrl(symbol, timeframe, limitForRange(interval, range)), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { bars?: Bar[] };
    const bars = Array.isArray(body.bars) ? body.bars.filter((bar) => Number.isFinite(bar?.close)) : [];
    if (!bars.length) return null;
    return { bars, quote: quoteFromBars(symbol, bars) };
  } catch {
    return null;
  }
}
