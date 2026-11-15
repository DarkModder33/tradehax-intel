import type { Bar, Timeframe } from "@/lib/indicators/types";
import { aggregateBars } from "./resample";
import { MarketDataError, type MarketDataProvider } from "./provider";
import type { Quote, SymbolSnapshot } from "./types";

const CHART = "https://ts-api.cnbc.com/harmony/app/charts";
const QUOTE =
  "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol";

export interface CnbcQuote {
  symbol: string;
  price: number;
  asOfLabel: string | null;
}

interface CnbcBar {
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: number;
  tradeTime?: string;
}

/** CNBC stamps are exchange-local America/New_York, YYYYMMDDHHMMSS. */
export function parseCnbcStamp(stamp: string): number | null {
  if (!/^\d{14}$/.test(stamp)) return null;
  const year = Number(stamp.slice(0, 4));
  const month = Number(stamp.slice(4, 6));
  const day = Number(stamp.slice(6, 8));
  const hour = Number(stamp.slice(8, 10));
  const minute = Number(stamp.slice(10, 12));
  const second = Number(stamp.slice(12, 14));
  let instant = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = Date.UTC(year, month - 1, day, hour, minute, second) - newYorkOffset(instant);
  }
  return instant;
}

function newYorkOffset(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return asUtc - utcMs;
}

export function parseCnbcBars(rows: CnbcBar[]): Bar[] {
  const bars: Bar[] = [];
  for (const row of rows) {
    const time = row.tradeTime ? parseCnbcStamp(row.tradeTime) : null;
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    if (time == null || ![open, high, low, close].every(Number.isFinite) || close === 0) continue;
    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(row.volume) ? Number(row.volume) : 0,
    });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new MarketDataError(`CNBC returned ${response.status}.`);
  return response.json();
}

async function fetchChart(symbol: string, range: "1D" | "5D" | "6M"): Promise<Bar[]> {
  const payload = (await getJson(`${CHART}/${range}.json?symbol=${encodeURIComponent(symbol)}`)) as {
    barData?: { priceBars?: CnbcBar[] };
  };
  return parseCnbcBars(payload.barData?.priceBars ?? []);
}

export async function fetchCnbcQuotes(symbols: string[]): Promise<CnbcQuote[]> {
  if (symbols.length === 0) return [];
  const payload = (await getJson(
    `${QUOTE}?symbols=${encodeURIComponent(symbols.join("|"))}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=0&output=json&events=1`,
  )) as {
    FormattedQuoteResult?: { FormattedQuote?: Array<Record<string, string>> };
  };
  const rows = payload.FormattedQuoteResult?.FormattedQuote ?? [];
  const wanted = new Set(symbols);
  const quotes: CnbcQuote[] = [];
  for (const row of rows) {
    const symbol = row.symbol;
    const price = Number(row.last);
    if (!symbol || !wanted.has(symbol) || !Number.isFinite(price)) continue;
    quotes.push({ symbol, price, asOfLabel: row.last_timedate ?? null });
  }
  return quotes;
}

/**
 * Second price source. CNBC's chart host sends Access-Control-Allow-Origin: *.
 * 1D is about one session of 1-minute bars, 5D is 5-minute bars, 6M is daily.
 */
export class CnbcMarketData implements MarketDataProvider {
  readonly id = "cnbc";
  readonly label = "CNBC public charts";
  readonly kind = "live" as const;
  readonly disclaimer =
    "Prices come from CNBC's public chart feed because Yahoo did not return this symbol. Quotes can be delayed.";

  async load(symbol: string, timeframes: readonly Timeframe[]): Promise<SymbolSnapshot> {
    const needed = new Set(timeframes);
    const [minute, fiveMinute, daily] = await Promise.all([
      needed.has("1m") ? fetchChart(symbol, "1D") : Promise.resolve([]),
      needed.has("5m") || needed.has("15m") || needed.has("1h") || needed.has("4h")
        ? fetchChart(symbol, "5D")
        : Promise.resolve([]),
      needed.has("1d") ? fetchChart(symbol, "6M") : Promise.resolve([]),
    ]);
    const bars: SymbolSnapshot["bars"] = {};
    if (needed.has("1m")) bars["1m"] = minute;
    if (needed.has("5m")) bars["5m"] = fiveMinute;
    if (needed.has("15m")) bars["15m"] = aggregateBars(fiveMinute, 15 * 60_000);
    if (needed.has("1h")) bars["1h"] = aggregateBars(fiveMinute, 60 * 60_000);
    if (needed.has("4h")) bars["4h"] = aggregateBars(fiveMinute, 4 * 60 * 60_000);
    if (needed.has("1d")) bars["1d"] = daily;
    const last = daily.at(-1) ?? fiveMinute.at(-1) ?? minute.at(-1);
    if (!last) throw new MarketDataError(`No CNBC price data for ${symbol}.`, symbol);
    const previous = (daily.length > 1 ? daily.at(-2) : fiveMinute.at(-2)) ?? null;
    const quote: Quote = {
      symbol,
      price: last.close,
      previousClose: previous?.close ?? null,
      changePercent: previous && previous.close !== 0 ? ((last.close - previous.close) / previous.close) * 100 : null,
      currency: "USD",
      asOf: last.time,
    };
    return { quote, bars };
  }
}

let singleton: CnbcMarketData | null = null;

export function getCnbcProvider(): CnbcMarketData {
  singleton ??= new CnbcMarketData();
  return singleton;
}
