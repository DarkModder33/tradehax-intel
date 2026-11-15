import type { Bar, Timeframe } from "@/lib/indicators/types";
import { Limiter } from "./limiter";
import { MarketDataError, type MarketDataProvider } from "./provider";
import { aggregateBars } from "./resample";
import type { Quote, SymbolSnapshot } from "./types";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const USER_AGENT = "TradeHax/0.1 (market-intelligence; +https://tradehax.net)";

const TTL_MS: Record<string, number> = {
  "1m": 30_000,
  "5m": 60_000,
  "15m": 90_000,
  "60m": 5 * 60_000,
  "1d": 15 * 60_000,
};

interface ChartPayload {
  bars: Bar[];
  quote: Quote;
}

interface CacheEntry {
  expires: number;
  value: ChartPayload;
}

function toMs(time: number): number {
  return time < 1e12 ? time * 1000 : time;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNumberList(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asNumber(item));
}

function trimTrailingZeroVolume(bars: Bar[]): Bar[] {
  const next = [...bars];
  while (next.length > 1 && next[next.length - 1].volume === 0) next.pop();
  return next;
}

/** Turn a Yahoo chart JSON payload into bars and a quote. Throws MarketDataError on failure. */
export function parseYahooChart(payload: unknown, symbol: string): ChartPayload {
  const root = asRecord(payload);
  const chart = asRecord(root?.chart);
  const result = Array.isArray(chart?.result) ? chart.result[0] : null;
  const row = asRecord(result);
  if (!row) {
    const error = asRecord(chart?.error);
    const description = typeof error?.description === "string" ? error.description : "No price data.";
    throw new MarketDataError(description, symbol);
  }

  const timestamps = Array.isArray(row.timestamp) ? row.timestamp : [];
  const indicators = asRecord(row.indicators);
  const quoteRows = Array.isArray(indicators?.quote) ? indicators.quote : [];
  const quoteRow = asRecord(quoteRows[0]);
  const opens = asNumberList(quoteRow?.open);
  const highs = asNumberList(quoteRow?.high);
  const lows = asNumberList(quoteRow?.low);
  const closes = asNumberList(quoteRow?.close);
  const volumes = asNumberList(quoteRow?.volume);

  const bars: Bar[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const time = asNumber(timestamps[index]);
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];
    const volume = volumes[index];
    if (
      time == null ||
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      volume == null
    ) {
      continue;
    }
    bars.push({ time: toMs(time), open, high, low, close, volume });
  }
  bars.sort((a, b) => a.time - b.time);
  const trimmed = trimTrailingZeroVolume(bars);

  const meta = asRecord(row.meta);
  const lastClose = trimmed[trimmed.length - 1]?.close ?? bars[bars.length - 1]?.close ?? null;
  const price = asNumber(meta?.regularMarketPrice) ?? lastClose;
  if (price == null) throw new MarketDataError(`No price data for ${symbol}.`, symbol);

  const previousClose = asNumber(meta?.previousClose) ?? asNumber(meta?.chartPreviousClose);
  const marketTime = asNumber(meta?.regularMarketTime);
  const currency = typeof meta?.currency === "string" ? meta.currency : "USD";

  return {
    bars: trimmed,
    quote: {
      symbol,
      price,
      previousClose,
      changePercent:
        previousClose != null && previousClose !== 0
          ? ((price - previousClose) / previousClose) * 100
          : null,
      currency,
      asOf: marketTime != null ? toMs(marketTime) : (trimmed[trimmed.length - 1]?.time ?? 0),
    },
  };
}

function yahooSymbol(symbol: string): string {
  return symbol.replace(/\./g, "-");
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Unofficial Yahoo Finance chart endpoint. No key. Quotes can be delayed.
 * Responses are cached in memory for the life of the server process.
 */
export class YahooMarketData implements MarketDataProvider {
  readonly id = "yahoo";
  readonly label = "Yahoo Finance public data";
  readonly kind = "live" as const;
  readonly disclaimer =
    "Prices come from Yahoo Finance's public chart endpoint. Quotes can be delayed. This is research, not a recommendation.";

  private readonly limiter = new Limiter(4);
  private readonly cache = new Map<string, CacheEntry>();

  async load(symbol: string, timeframes: readonly Timeframe[]): Promise<SymbolSnapshot> {
    const needed = new Set(timeframes);
    const requests: Array<{ id: string; interval: string; range: string }> = [];
    const add = (id: string, interval: string, range: string) => {
      if (!requests.some((request) => request.id === id)) requests.push({ id, interval, range });
    };
    if (needed.has("1m")) add("1m", "1m", "1d");
    if (needed.has("5m")) add("5m", "5m", "5d");
    if (needed.has("15m")) add("15m", "15m", "5d");
    if (needed.has("1h") || needed.has("4h")) add("60m", "60m", "3mo");
    if (needed.has("1d")) add("1d", "1d", "1y");

    const settled = await Promise.allSettled(
      requests.map(async (request) => ({
        id: request.id,
        result: await this.chart(symbol, request.interval, request.range),
      })),
    );
    const ok = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
    if (ok.length === 0) {
      const failure = settled.find((item) => item.status === "rejected");
      if (failure?.status === "rejected" && failure.reason instanceof Error) throw failure.reason;
      throw new MarketDataError(`No price data for ${symbol}.`, symbol);
    }

    const byId = new Map(ok.map((item) => [item.id, item.result]));
    const quote = ok[0].result.quote;
    const hourly = byId.get("60m")?.bars ?? [];
    const bars: SymbolSnapshot["bars"] = {};
    if (needed.has("1m")) bars["1m"] = byId.get("1m")?.bars ?? [];
    if (needed.has("5m")) bars["5m"] = byId.get("5m")?.bars ?? [];
    if (needed.has("15m")) bars["15m"] = byId.get("15m")?.bars ?? [];
    if (needed.has("1h")) bars["1h"] = hourly;
    if (needed.has("4h")) bars["4h"] = aggregateBars(hourly, FOUR_HOURS_MS);
    if (needed.has("1d")) bars["1d"] = byId.get("1d")?.bars ?? [];
    return { quote: { ...quote, symbol }, bars };
  }

  private async chart(symbol: string, interval: string, range: string): Promise<ChartPayload> {
    const key = `${symbol}|${interval}|${range}`;
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await this.limiter.run(() => this.fetchChart(symbol, interval, range));
    this.cache.set(key, { expires: Date.now() + (TTL_MS[interval] ?? 60_000), value });
    return value;
  }

  private async fetchChart(symbol: string, interval: string, range: string): Promise<ChartPayload> {
    const params = new URLSearchParams({
      interval,
      range,
      includePrePost: "false",
      events: "div|split",
    });
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?${params}`;
    let lastError: Error = new MarketDataError(`No price data for ${symbol}.`, symbol);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        });
        if (response.status === 429 || response.status >= 500) {
          lastError = new MarketDataError(`Yahoo Finance returned ${response.status}.`, symbol);
          await delay(400 * (attempt + 1));
          continue;
        }
        if (!response.ok) {
          throw new MarketDataError(`Yahoo Finance returned ${response.status}.`, symbol);
        }
        return parseYahooChart(await response.json(), symbol);
      } catch (error) {
        if (error instanceof MarketDataError && !/returned (429|5\d\d)/.test(error.message)) {
          throw error;
        }
        lastError = error instanceof Error ? error : lastError;
        if (attempt === 0) await delay(400);
      }
    }
    throw lastError;
  }
}

let singleton: YahooMarketData | null = null;

export function getYahooProvider(): YahooMarketData {
  singleton ??= new YahooMarketData();
  return singleton;
}
