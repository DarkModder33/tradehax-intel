export type FreshnessKind = "live" | "intraday" | "daily" | "weekly";

export const STALE_AFTER_MS: Record<FreshnessKind, number> = {
  live: 5 * 60_000,
  intraday: 45 * 60_000,
  daily: 30 * 60 * 60_000,
  weekly: 10 * 24 * 60 * 60_000,
};

export function isStale(asOfMs: number, kind: FreshnessKind, now: number): boolean {
  if (!Number.isFinite(asOfMs)) return false;
  return now - asOfMs > STALE_AFTER_MS[kind];
}

export function parseAsOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isFinite(parsed) ? parsed : null;
}
