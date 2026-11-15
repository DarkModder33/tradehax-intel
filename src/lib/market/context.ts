import type { Direction } from "@/lib/indicators/types";
import { parseCnbcBars } from "./cnbc";

export interface Headline {
  title: string;
  publisher: string;
  url: string | null;
}

export interface HeadlineResult {
  symbol: string;
  status: "ok" | "unavailable";
  items: Headline[];
}

export interface CryptoQuote {
  id: string;
  label: string;
  usd: number;
  change24h: number | null;
}

export interface SectorStrength {
  symbol: string;
  name: string;
  return20d: number;
  excessVsSpy: number;
}

export type RiskRegime = "risk-on" | "mixed" | "risk-off";
export type VolRegime = "calm" | "normal" | "elevated" | "stress";

export interface MarketContext {
  source: string;
  vix: { level: number; regime: VolRegime } | null;
  spyTrend: "up" | "down" | null;
  qqqTrend: "up" | "down" | null;
  risk: RiskRegime | null;
  riskDetail: string;
  sectors: SectorStrength[];
  crypto: CryptoQuote[];
  earnings: { status: "unavailable"; detail: string };
}

export const SECTORS: { symbol: string; name: string }[] = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLV", name: "Health care" },
  { symbol: "XLY", name: "Discretionary" },
  { symbol: "XLI", name: "Industrials" },
];

export const SYMBOL_SECTOR: Record<string, string> = {
  AAPL: "XLK",
  MSFT: "XLK",
  NVDA: "XLK",
  AMD: "XLK",
  AVGO: "XLK",
  AMZN: "XLY",
  TSLA: "XLY",
  HD: "XLY",
  META: "XLC",
  GOOGL: "XLC",
  GOOG: "XLC",
  JPM: "XLF",
  GS: "XLF",
  XOM: "XLE",
  CVX: "XLE",
  UNH: "XLV",
  JNJ: "XLV",
  CAT: "XLI",
};

const UNAVAILABLE_EARNINGS = {
  status: "unavailable" as const,
  detail: "Earnings dates: no keyless browser source returned a calendar.",
};

export function volatilityRegime(level: number): VolRegime {
  if (level >= 30) return "stress";
  if (level >= 20) return "elevated";
  if (level >= 15) return "normal";
  return "calm";
}

export function trendSide(closes: number[], lookback = 20): "up" | "down" | null {
  if (closes.length < lookback) return null;
  const window = closes.slice(-lookback);
  const average = window.reduce((sum, value) => sum + value, 0) / window.length;
  const last = closes[closes.length - 1];
  if (!Number.isFinite(last) || average === 0) return null;
  return last >= average ? "up" : "down";
}

export function returnOver(closes: number[], lookback = 20): number | null {
  if (closes.length <= lookback) return null;
  const then = closes[closes.length - 1 - lookback];
  const now = closes[closes.length - 1];
  if (!Number.isFinite(then) || then === 0 || !Number.isFinite(now)) return null;
  return now / then - 1;
}

export function classifyRisk(input: {
  vix: number | null;
  spyTrend: "up" | "down" | null;
  qqqTrend: "up" | "down" | null;
}): RiskRegime | null {
  if (input.vix == null || !input.spyTrend || !input.qqqTrend) return null;
  const equityDown = input.spyTrend === "down" || input.qqqTrend === "down";
  const equityUp = input.spyTrend === "up" && input.qqqTrend === "up";
  if (input.vix >= 22 && equityDown) return "risk-off";
  if (input.vix < 18 && equityUp) return "risk-on";
  return "mixed";
}

export function regimeNote(direction: Direction, risk: RiskRegime | null): string | null {
  if (!risk || direction === "neutral") return null;
  if (direction === "bullish" && risk === "risk-off") return "Bullish signal against a risk-off market.";
  if (direction === "bearish" && risk === "risk-on") return "Bearish signal against a risk-on market.";
  if (direction === "bullish" && risk === "risk-on") return "Bullish signal with the risk-on tape.";
  if (direction === "bearish" && risk === "risk-off") return "Bearish signal with the risk-off tape.";
  return null;
}

export function rankSectors(
  series: { symbol: string; name: string; closes: number[] }[],
  spyCloses: number[],
): SectorStrength[] {
  const spy = returnOver(spyCloses);
  if (spy == null) return [];
  const ranked: SectorStrength[] = [];
  for (const item of series) {
    const own = returnOver(item.closes);
    if (own == null) continue;
    ranked.push({
      symbol: item.symbol,
      name: item.name,
      return20d: own,
      excessVsSpy: own - spy,
    });
  }
  return ranked.sort((a, b) => b.excessVsSpy - a.excessVsSpy);
}

async function cnbcDaily(symbol: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://ts-api.cnbc.com/harmony/app/charts/6M.json?symbol=${encodeURIComponent(symbol)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { barData?: { priceBars?: BarLike[] } };
    const bars = parseCnbcBars(payload.barData?.priceBars ?? []);
    return bars.map((bar) => bar.close);
  } catch {
    return null;
  }
}

interface BarLike {
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: number;
  tradeTime?: string;
}

async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function loadMarketContext(): Promise<MarketContext> {
  const symbols = ["SPY", "QQQ", ".VIX", ...SECTORS.map((sector) => sector.symbol)];
  const closes = await mapPool(symbols, 4, (symbol) => cnbcDaily(symbol));
  const bySymbol = new Map(symbols.map((symbol, index) => [symbol, closes[index]]));
  const spy = bySymbol.get("SPY") ?? null;
  const qqq = bySymbol.get("QQQ") ?? null;
  const vixCloses = bySymbol.get(".VIX") ?? null;
  const vixLevel = vixCloses?.at(-1) ?? null;
  const spyTrend = spy ? trendSide(spy) : null;
  const qqqTrend = qqq ? trendSide(qqq) : null;
  const risk = classifyRisk({ vix: vixLevel, spyTrend, qqqTrend });
  const sectors = spy
    ? rankSectors(
        SECTORS.flatMap((sector) => {
          const series = bySymbol.get(sector.symbol);
          return series ? [{ ...sector, closes: series }] : [];
        }),
        spy,
      )
    : [];
  const crypto = await loadCrypto();
  const vol = vixLevel == null ? null : volatilityRegime(vixLevel);
  const riskDetail = describeRisk({ vix: vixLevel, vol, spyTrend, qqqTrend, risk });
  return {
    source: "CNBC daily charts",
    vix: vixLevel == null || vol == null ? null : { level: vixLevel, regime: vol },
    spyTrend,
    qqqTrend,
    risk,
    riskDetail,
    sectors,
    crypto,
    earnings: UNAVAILABLE_EARNINGS,
  };
}

function describeRisk(input: {
  vix: number | null;
  vol: VolRegime | null;
  spyTrend: "up" | "down" | null;
  qqqTrend: "up" | "down" | null;
  risk: RiskRegime | null;
}): string {
  if (input.vix == null || !input.spyTrend || !input.qqqTrend || !input.risk || !input.vol) {
    return "Market regime did not load.";
  }
  const volText =
    input.vol === "calm"
      ? "calm"
      : input.vol === "normal"
        ? "ordinary"
        : input.vol === "elevated"
          ? "elevated"
          : "stressed";
  return `VIX ${input.vix.toFixed(1)} is ${volText}. SPY's 20-day trend is ${input.spyTrend}, QQQ's is ${input.qqqTrend}. The tape reads ${input.risk}.`;
}

async function loadCrypto(): Promise<CryptoQuote[]> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const rows: CryptoQuote[] = [];
    for (const [id, label] of [
      ["bitcoin", "BTC"],
      ["ethereum", "ETH"],
    ] as const) {
      const usd = payload[id]?.usd;
      if (!Number.isFinite(usd)) continue;
      const change = payload[id]?.usd_24h_change;
      rows.push({
        id,
        label,
        usd: usd as number,
        change24h: Number.isFinite(change) ? (change as number) : null,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

const headlineCache = new Map<string, { expires: number; result: HeadlineResult }>();

export async function fetchHeadlines(symbol: string): Promise<HeadlineResult> {
  const cached = headlineCache.get(symbol);
  if (cached && cached.expires > Date.now()) return cached.result;
  try {
    const response = await fetch(
      `https://proxy.cors.dev/https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=2&quotesCount=0`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) {
      const result: HeadlineResult = { symbol, status: "unavailable", items: [] };
      return result;
    }
    const payload = (await response.json()) as {
      news?: Array<{ title?: string; publisher?: string; link?: string }>;
    };
    const items = (payload.news ?? [])
      .filter((item) => typeof item.title === "string" && item.title.trim())
      .slice(0, 2)
      .map((item) => ({
        title: item.title as string,
        publisher: item.publisher || "Yahoo Finance",
        url: item.link || null,
      }));
    const result: HeadlineResult = { symbol, status: "ok", items };
    headlineCache.set(symbol, { expires: Date.now() + 10 * 60_000, result });
    return result;
  } catch {
    return { symbol, status: "unavailable", items: [] };
  }
}

export async function loadHeadlines(symbols: string[]): Promise<HeadlineResult[]> {
  const results: HeadlineResult[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < symbols.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fetchHeadlines(symbols[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, symbols.length) }, () => worker()));
  return results;
}
