import type { Bar, Timeframe } from "@/lib/indicators/types";
import type { MarketDataProvider } from "./provider";
import type { Quote, SymbolSnapshot } from "./types";

const STEP_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

interface Profile {
  start: number;
  vol: number;
  drift: number;
  volume: number;
}

const PROFILES: Record<string, Profile> = {
  SPY: { start: 560, vol: 0.004, drift: 0.00015, volume: 8_000_000 },
  QQQ: { start: 490, vol: 0.005, drift: 0.0002, volume: 5_000_000 },
  IWM: { start: 220, vol: 0.006, drift: 0.00005, volume: 3_000_000 },
  AAPL: { start: 230, vol: 0.007, drift: 0.0002, volume: 5_000_000 },
  MSFT: { start: 420, vol: 0.006, drift: 0.00018, volume: 2_200_000 },
  NVDA: { start: 140, vol: 0.014, drift: 0.00045, volume: 18_000_000 },
  AMZN: { start: 200, vol: 0.008, drift: 0.00015, volume: 4_000_000 },
  META: { start: 580, vol: 0.009, drift: 0.0002, volume: 1_500_000 },
  TSLA: { start: 320, vol: 0.016, drift: -0.00025, volume: 9_000_000 },
  AMD: { start: 150, vol: 0.013, drift: 0.0003, volume: 4_000_000 },
};

function hash(value: string): number {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function profileFor(symbol: string): Profile {
  const known = PROFILES[symbol];
  if (known) return known;
  const seed = hash(symbol);
  return {
    start: 40 + (seed % 400),
    vol: 0.008 + (seed % 7) * 0.001,
    drift: ((seed % 11) - 5) * 0.00008,
    volume: 500_000 + (seed % 2_000_000),
  };
}

function synthesize(symbol: string, timeframe: Timeframe, count: number, now: number, profile: Profile): Bar[] {
  const rand = mulberry32(hash(`${symbol}:${timeframe}:path`));
  let price = profile.start;
  const step = STEP_MS[timeframe];
  const start = now - count * step;
  const bars: Bar[] = [];
  for (let index = 0; index < count; index += 1) {
    const open = price;
    const shock = (rand() - 0.48) * profile.vol;
    price = Math.max(0.5, price * (1 + profile.drift + shock));
    const close = price;
    const wick = Math.max(open, close) * profile.vol * rand() * 0.35;
    const tail = Math.min(open, close) * profile.vol * rand() * 0.35;
    const spike = rand() > 0.93 ? 2.2 : 1;
    bars.push({
      time: start + index * step,
      open,
      high: Math.max(open, close) + wick,
      low: Math.max(0.01, Math.min(open, close) - tail),
      close,
      volume: Math.round(profile.volume * (0.55 + rand()) * spike * (timeframe === "1d" ? 1 : 0.08)),
    });
  }
  return bars;
}

function rescale(bars: Bar[], target: number): Bar[] {
  const last = bars[bars.length - 1]?.close ?? target;
  if (last === 0) return bars;
  const ratio = target / last;
  return bars.map((bar) => ({
    ...bar,
    open: bar.open * ratio,
    high: bar.high * ratio,
    low: bar.low * ratio,
    close: bar.close * ratio,
  }));
}

function nudgeLast(bars: Bar[], now: number, symbol: string, profile: Profile): Bar[] {
  if (bars.length === 0) return bars;
  const next = bars.map((bar) => ({ ...bar }));
  const last = next[next.length - 1];
  const bucket = Math.floor(now / 15_000);
  const rand = mulberry32(hash(`${symbol}:tick:${bucket}`));
  const move = (rand() - 0.5) * profile.vol * 0.35 * last.close;
  last.close = Math.max(0.5, last.close + move);
  last.high = Math.max(last.high, last.close);
  last.low = Math.min(last.low, last.close);
  last.time = now;
  return next;
}

/**
 * Simulated prices with a stable per-symbol personality and a small tick every
 * 15 seconds. Never present this as the market. The dashboard labels it.
 */
export class MockMarketData implements MarketDataProvider {
  readonly id = "mock";
  readonly label = "Simulated demo feed";
  readonly kind = "demo" as const;
  readonly disclaimer =
    "Demo data. These prices are simulated, not the live market. They exist so the desk still runs when a price source is unavailable.";

  async load(symbol: string, timeframes: readonly Timeframe[]): Promise<SymbolSnapshot> {
    const now = Date.now();
    const profile = profileFor(symbol);
    const anchor = profile.start * (1 + (((hash(symbol) % 200) - 80) / 1000));
    const bars = {} as SymbolSnapshot["bars"];
    let lastPrice = anchor;
    for (const timeframe of timeframes) {
      const count = timeframe === "1d" ? 220 : 160;
      const series = nudgeLast(rescale(synthesize(symbol, timeframe, count, now, profile), anchor), now, symbol, profile);
      bars[timeframe] = series;
      lastPrice = series[series.length - 1]?.close ?? lastPrice;
    }
    const dayBias = ((hash(symbol) % 200) - 80) / 1000;
    const previousClose = dayBias === -1 ? null : lastPrice / (1 + dayBias);
    const quote: Quote = {
      symbol,
      price: lastPrice,
      previousClose,
      changePercent:
        previousClose != null && previousClose !== 0
          ? ((lastPrice - previousClose) / previousClose) * 100
          : null,
      currency: "USD",
      asOf: now,
    };
    return { quote, bars };
  }
}

export function createMockProvider(): MockMarketData {
  return new MockMarketData();
}
