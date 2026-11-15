import { studySnapshots } from "@/lib/engine/study";
import { TIMEFRAMES } from "@/lib/indicators/types";
import { buildSignal } from "@/lib/indicators/build-signal";
import { readJournal, summarizeJournal, updateJournal, writeJournal } from "@/lib/journal";
import { fetchCnbcQuotes, getCnbcProvider } from "./cnbc";
import { loadHeadlines, loadMarketContext } from "./context";
import { comparePrices, describeHealth } from "./health";
import { createMockProvider } from "./mock";
import type { MarketDataProvider } from "./provider";
import type { DashboardPayload, Quote, SymbolError, SymbolSnapshot } from "./types";
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

interface Collected {
  quotes: Quote[];
  signals: DashboardPayload["signals"];
  errors: SymbolError[];
  snapshots: SymbolSnapshot[];
}

async function collect(provider: MarketDataProvider, symbols: string[]): Promise<Collected> {
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

  const quotes: Quote[] = [];
  const signals: DashboardPayload["signals"] = [];
  const errors: SymbolError[] = [];
  const snapshots: SymbolSnapshot[] = [];
  for (const row of rows) {
    if (!row.snapshot) {
      errors.push({ symbol: row.symbol, message: row.error ?? `No price data for ${row.symbol}.` });
      continue;
    }
    quotes.push(row.snapshot.quote);
    snapshots.push(row.snapshot);
    for (const timeframe of TIMEFRAMES) {
      signals.push(buildSignal(row.symbol, timeframe, row.snapshot.bars[timeframe] ?? []));
    }
  }
  return { quotes, signals, errors, snapshots };
}

async function runStudy(snapshots: SymbolSnapshot[]) {
  // Yield once so the loading shell can paint before the walk-forward fit.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return studySnapshots(snapshots);
}

function remember(signals: DashboardPayload["signals"], snapshots: SymbolSnapshot[]) {
  const journal = updateJournal(
    readJournal(),
    signals,
    snapshots.map((snapshot) => ({ symbol: snapshot.quote.symbol, bars: snapshot.bars })),
  );
  writeJournal(journal);
  return summarizeJournal(journal);
}

async function finish(
  source: DashboardPayload["source"],
  collected: Collected,
  healthKind: "live" | "demo",
  secondaryOk: boolean,
  gaps: ReturnType<typeof comparePrices>,
): Promise<DashboardPayload> {
  const asOf = collected.quotes.reduce((max, quote) => Math.max(max, quote.asOf), 0) || null;
  const study = await runStudy(collected.snapshots);
  let context = null;
  let headlines: DashboardPayload["headlines"] = [];
  if (healthKind === "live") {
    const symbols = collected.quotes.map((quote) => quote.symbol);
    const [loadedContext, loadedHeadlines] = await Promise.all([
      loadMarketContext().catch(() => null),
      loadHeadlines(symbols).catch(() => []),
    ]);
    context = loadedContext;
    headlines = loadedHeadlines;
  }
  return {
    source,
    updatedAt: Date.now(),
    quotes: collected.quotes,
    signals: collected.signals,
    errors: collected.errors,
    health: describeHealth({
      primaryLabel: source.label,
      kind: healthKind,
      secondaryOk,
      gaps,
      asOf,
    }),
    context,
    cells: study.cells,
    notes: study.notes,
    track: study.track,
    journal: remember(collected.signals, collected.snapshots),
    headlines,
  };
}

export async function loadDashboard(symbols: string[]): Promise<DashboardPayload> {
  if (providerMode() === "mock") {
    const collected = await collect(createMockProvider(), symbols);
    return finish(
      {
        id: "mock",
        kind: "demo",
        label: "Simulated demo feed",
        disclaimer: createMockProvider().disclaimer,
        fallbackReason: null,
      },
      collected,
      "demo",
      false,
      [],
    );
  }

  const yahoo = getYahooProvider();
  const primary = await collect(yahoo, symbols);
  const missing = symbols.filter((symbol) => !primary.quotes.some((quote) => quote.symbol === symbol));
  if (missing.length > 0) {
    const backup = await collect(getCnbcProvider(), missing);
    primary.quotes.push(...backup.quotes);
    primary.signals.push(...backup.signals);
    primary.snapshots.push(...backup.snapshots);
    primary.errors = primary.errors.filter((error) => !missing.includes(error.symbol));
    primary.errors.push(...backup.errors);
  }

  if (primary.quotes.length === 0) {
    const demo = await collect(createMockProvider(), symbols);
    const fallbackReason = "Live prices did not load, so this board is simulated.";
    return finish(
      {
        id: "mock",
        kind: "demo",
        label: "Simulated demo feed",
        disclaimer: `${createMockProvider().disclaimer} ${fallbackReason}`,
        fallbackReason,
      },
      demo,
      "demo",
      false,
      [],
    );
  }

  let secondaryOk = false;
  let gaps: ReturnType<typeof comparePrices> = [];
  try {
    const check = await fetchCnbcQuotes(primary.quotes.map((quote) => quote.symbol));
    secondaryOk = check.length > 0;
    gaps = comparePrices(primary.quotes, check);
  } catch {
    secondaryOk = false;
  }

  const filled = missing.filter((symbol) => primary.quotes.some((quote) => quote.symbol === symbol));
  return finish(
    {
      id: filled.length > 0 && filled.length === primary.quotes.length ? "cnbc" : "yahoo",
      kind: "live",
      label: filled.length > 0 ? "Yahoo Finance, with CNBC filling gaps" : yahoo.label,
      disclaimer: yahoo.disclaimer,
      fallbackReason: null,
    },
    primary,
    "live",
    secondaryOk,
    gaps,
  );
}
