import type { Direction } from "@/lib/indicators/types";

export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return "n/a";
  const digits = Math.abs(price) >= 1 ? 2 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(price);
}

export function formatChange(percent: number | null): string {
  return formatSignedPercent(percent, 2);
}

/** Fixed digits. Components call this instead of `toFixed`. */
export function formatDigits(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

/** `$1.24M`, `12.3K`, or a plain price when the value is small. */
export function formatCompact(value: number | null | undefined, withDollar = true): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const prefix = withDollar ? "$" : "";
  if (abs >= 1_000_000_000) return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(abs >= 100 ? 0 : 2)}`;
}

/** A ratio such as 0.123 becomes `+12.3%`. `points` means the value is already in percent. */
export function formatSignedPercent(value: number | null | undefined, digits = 1, points = false): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const shown = points ? value : value * 100;
  const sign = shown > 0 ? "+" : "";
  return `${sign}${shown.toFixed(digits)}%`;
}

/** `NVDA 12/18 200C` from an OCC symbol. Returns the input when it does not parse. */
export function formatOcc(symbol: string): string {
  const match = symbol.trim().toUpperCase().match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return symbol;
  const [, root, , month, day, right, strike] = match;
  const price = Number(strike) / 1000;
  const shown = Number.isInteger(price) ? String(price) : String(price);
  return `${root} ${month}/${day} ${shown}${right}`;
}

/** `4:00 PM ET`. */
export function formatEtClock(ms: number): string {
  if (!ms) return "n/a";
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
  return `${clock} ET`;
}

export function formatEt(ms: number): string {
  if (!ms) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

export function formatAge(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hr ago`;
}

export function directionLabel(direction: Direction): string {
  if (direction === "bullish") return "▲ Bullish";
  if (direction === "bearish") return "▼ Bearish";
  return "Mixed";
}

/** Colour-blind safe marker. The sign is included as well as the arrow. */
export function signedGlyph(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "• 0";
  return value > 0 ? `▲ +${value}` : `▼ ${value}`;
}

export function directionClass(direction: Direction | "split"): string {
  if (direction === "bullish") return "text-bullish";
  if (direction === "bearish") return "text-bearish";
  return "text-muted-foreground";
}
