import type { Direction, Timeframe } from "@/lib/indicators/types";
import type { DashboardPayload } from "@/lib/market/types";
import { DASHBOARD_POLL_MS } from "@/components/use-dashboard";
import { normalizePopoutPrefs, type PopoutPrefs } from "./prefs";

export const POPOUT_CHANNEL = "tradehax.popout";

export type PopoutMessage =
  | { type: "snapshot"; sentAt: number; payload: DashboardPayload }
  | { type: "prefs"; prefs: PopoutPrefs };

export function snapshotCovers(
  payload: { quotes: { symbol: string }[]; errors: { symbol: string }[] },
  symbols: string[],
): boolean {
  if (symbols.length === 0) return false;
  const have = new Set([...payload.quotes.map((quote) => quote.symbol), ...payload.errors.map((error) => error.symbol)]);
  return symbols.every((symbol) => have.has(symbol));
}

export function snapshotIsFresh(sentAt: number, now: number, pollMs = DASHBOARD_POLL_MS): boolean {
  return Number.isFinite(sentAt) && now - sentAt >= 0 && now - sentAt < pollMs * 2;
}

export function directionMap(
  signals: { symbol: string; timeframe: Timeframe; direction: Direction }[],
  timeframe: Timeframe,
): Record<string, Direction> {
  const map: Record<string, Direction> = {};
  for (const signal of signals) {
    if (signal.timeframe === timeframe) map[signal.symbol] = signal.direction;
  }
  return map;
}

/** Symbols whose direction changed. A name that was not on the previous tape is not a flip. */
export function flippedSymbols(previous: Record<string, Direction>, next: Record<string, Direction>): string[] {
  return Object.keys(next).filter((symbol) => previous[symbol] != null && previous[symbol] !== next[symbol]);
}

export function readPopoutMessage(value: unknown): PopoutMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as { type?: unknown; sentAt?: unknown; payload?: DashboardPayload; prefs?: Partial<PopoutPrefs> };
  if (message.type === "snapshot" && typeof message.sentAt === "number" && message.payload && Array.isArray(message.payload.quotes)) {
    return { type: "snapshot", sentAt: message.sentAt, payload: message.payload };
  }
  if (message.type === "prefs" && message.prefs) {
    return { type: "prefs", prefs: normalizePopoutPrefs(message.prefs) };
  }
  return null;
}

export function postPopout(message: PopoutMessage): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(POPOUT_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // A snapshot that cannot be cloned stays in this window.
  }
}

export function regimeLabel(risk: "risk-on" | "mixed" | "risk-off" | null, vix: number | null): string {
  if (!risk) return "Regime unavailable";
  const name = risk === "risk-on" ? "Risk-on" : risk === "risk-off" ? "Risk-off" : "Mixed tape";
  return vix == null ? name : `${name} · VIX ${vix.toFixed(1)}`;
}

export function freshnessLabel(status: "agrees" | "disagrees" | "unavailable" | "demo", age: string): string {
  const source = status === "demo" ? "Demo data" : status === "disagrees" ? "Sources differ" : "Yahoo Finance";
  return `${source} · ${age}`;
}
