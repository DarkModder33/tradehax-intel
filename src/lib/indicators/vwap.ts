import type { Bar } from "./types";

/** US equity session date in America/New_York, as YYYY-MM-DD. */
export function sessionKey(time: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

export function sessionVwap(bars: Bar[], key: string): number | null {
  let priceVolume = 0;
  let volume = 0;
  for (const bar of bars) {
    if (sessionKey(bar.time) !== key || bar.volume <= 0) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    priceVolume += typical * bar.volume;
    volume += bar.volume;
  }
  if (volume <= 0) return null;
  return priceVolume / volume;
}

/** Volume-weighted typical price over the last `window` bars, including the current one. */
export function trailingVwap(bars: Bar[], window = 20): number | null {
  const slice = bars.slice(-window);
  let priceVolume = 0;
  let volume = 0;
  for (const bar of slice) {
    if (bar.volume <= 0) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    priceVolume += typical * bar.volume;
    volume += bar.volume;
  }
  if (volume <= 0) return null;
  return priceVolume / volume;
}
