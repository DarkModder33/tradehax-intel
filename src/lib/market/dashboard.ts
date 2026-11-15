import { TIMEFRAMES } from "@/lib/indicators/types";
import { buildSignal } from "@/lib/indicators/build-signal";
import { createMockProvider } from "./mock";
import type { MarketDataProvider } from "./provider";
import type { DashboardPayload } from "./types";
import { getYahooProvider } from "./yahoo";

export function providerMode(): "yahoo" | "mock" {
  const raw = process.env.NEXT_PUBLIC_MARKET_DATA_PROVIDER ?? "yahoo";
  return raw.trim().toLowerCase() === "mock" ? "mock" : "yahoo";
}

function cleanMessage(symbol: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : "No price data.";
  const safe = raw.replace(/\s+/g, " ").trim();
  if (!safe || safe.length > 160 || /[<>]/.test(safe)) return `No price data for ${symbol}.`;
  return safe.toLowerCase().startsWith(symbol.toLowerCase()) ? safe : `${symbol}: ${safe}`;
}

async function collect(provider: MarketDataProvider, symbols: string[]): Promise<DashboardPayload> {
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const snapshot = await provider.load(symbol, TIMEFRAMES);
        return { symbol, snapshot, error: null as string | null };
      } catch (error) {
        return { symbol, snapshot: null, error: cleanMessage(symbol, error) };
      }
    }),
  );

  const quotes = [];
  const signals = [];
  const errors = [];
  for (const row of rows) {
    if (!row.snapshot) {
      errors.push({ symbol: row.symbol, message: row.error ?? `No price data for ${row.symbol}.` });
      continue;
    }
    quotes.push(row.snapshot.quote);
    for (const timeframe of TIMEFRAMES) {
      signals.push(buildSignal(row.symbol, timeframe, row.snapshot.bars[timeframe] ?? []));
    }
  }

  return {
    source: {
      id: provider.id,
      kind: provider.kind,
      label: provider.label,
      disclaimer: provider.disclaimer,
      fallbackReason: null,
    },
    updatedAt: Date.now(),
    quotes,
    signals,
    errors,
  };
}

export async function loadDashboard(symbols: string[]): Promise<DashboardPayload> {
  if (providerMode() === "mock") return collect(createMockProvider(), symbols);

  const live = await collect(getYahooProvider(), symbols);
  if (live.quotes.length > 0) return live;

  const demo = await collect(createMockProvider(), symbols);
  const fallbackReason = "Yahoo Finance did not return prices, so this board is simulated.";
  demo.source.fallbackReason = fallbackReason;
  demo.source.disclaimer = `${demo.source.disclaimer} ${fallbackReason}`;
  return demo;
}
