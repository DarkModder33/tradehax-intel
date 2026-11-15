import { FORWARD_BARS } from "@/lib/backtest";
import type { Bar, Direction, Signal, Timeframe } from "@/lib/indicators/types";

export interface SettledCall {
  exitPrice: number;
  forwardReturn: number;
  calledReturn: number;
  hit: boolean;
  barsAhead: number;
}

export interface JournalEntry {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  direction: Exclude<Direction, "neutral">;
  probability: number;
  price: number;
  asOf: number;
  loggedAt: number;
  settled: SettledCall | null;
}

export interface JournalSummary {
  open: number;
  settled: number;
  hits: number;
  hitRate: number | null;
}

const STORAGE_KEY = "tradehax.signal-log";
const MAX_ENTRIES = 400;

export function journalId(symbol: string, timeframe: Timeframe, asOf: number): string {
  return `${symbol}|${timeframe}|${asOf}`;
}

export function updateJournal(
  existing: JournalEntry[],
  signals: Signal[],
  series: { symbol: string; bars: Partial<Record<Timeframe, Bar[]>> }[],
  now = Date.now(),
): JournalEntry[] {
  const byId = new Map(existing.map((entry) => [entry.id, { ...entry }]));

  for (const signal of signals) {
    if (signal.direction === "neutral" || !signal.asOf) continue;
    const id = journalId(signal.symbol, signal.timeframe, signal.asOf);
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      direction: signal.direction,
      probability: signal.probability,
      price: signal.price,
      asOf: signal.asOf,
      loggedAt: now,
      settled: null,
    });
  }

  for (const entry of byId.values()) {
    if (entry.settled) continue;
    const bars = series.find((item) => item.symbol === entry.symbol)?.bars[entry.timeframe];
    if (!bars) continue;
    const index = bars.findIndex((bar) => bar.time === entry.asOf);
    const horizon = FORWARD_BARS[entry.timeframe];
    if (index < 0 || index + horizon >= bars.length || entry.price === 0) continue;
    const exitPrice = bars[index + horizon].close;
    const forwardReturn = (exitPrice - entry.price) / entry.price;
    const calledReturn = entry.direction === "bullish" ? forwardReturn : -forwardReturn;
    entry.settled = {
      exitPrice,
      forwardReturn,
      calledReturn,
      hit: calledReturn > 0,
      barsAhead: horizon,
    };
  }

  return [...byId.values()].sort((a, b) => b.loggedAt - a.loggedAt).slice(0, MAX_ENTRIES);
}

export function summarizeJournal(entries: JournalEntry[]): JournalSummary {
  const settled = entries.filter((entry) => entry.settled);
  const hits = settled.filter((entry) => entry.settled?.hit).length;
  return {
    open: entries.length - settled.length,
    settled: settled.length,
    hits,
    hitRate: settled.length === 0 ? null : hits / settled.length,
  };
}

export function readJournal(): JournalEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is JournalEntry => {
      return Boolean(entry && typeof entry === "object" && "id" in entry && "asOf" in entry);
    });
  } catch {
    return [];
  }
}

export function writeJournal(entries: JournalEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function journalLine(summary: JournalSummary): string {
  if (summary.settled === 0) {
    return summary.open === 0
      ? "No calls have been logged on this device yet."
      : `${summary.open} live calls are logged on this device. None have reached their forward window yet.`;
  }
  const rate = summary.hitRate == null ? "n/a" : `${Math.round(summary.hitRate * 100)}%`;
  const callWord = summary.settled === 1 ? "call" : "calls";
  const timeWord = summary.hits === 1 ? "time" : "times";
  return `Logged on this device: ${summary.settled} settled ${callWord}, right ${summary.hits} ${timeWord} (${rate}). ${summary.open} still open.`;
}
