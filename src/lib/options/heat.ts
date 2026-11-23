export interface HeatInput {
  expiry: string;
  strike: number;
  netGex: number;
}

export interface HeatGrid {
  expiries: string[];
  strikes: number[];
  values: Map<string, number>;
  max: number;
  spotStrike: number | null;
  totals: Map<string, number>;
}

export const heatKey = (expiry: string, strike: number) => `${expiry}|${strike}`;

/**
 * Strike rows (high to low) by the nearest `columns` expiries. Cells outside the band are
 * dropped by the summary already; strikes keep only rows that carry some gamma.
 */
export function heatGrid(cells: HeatInput[], spot: number, columns = 8, rows = 30): HeatGrid {
  const clean = cells.filter((cell) => Number.isFinite(cell.netGex) && Number.isFinite(cell.strike) && cell.expiry);
  const expiries = [...new Set(clean.map((cell) => cell.expiry))].sort().slice(0, columns);
  const values = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const cell of clean) {
    if (!expiries.includes(cell.expiry)) continue;
    const key = heatKey(cell.expiry, cell.strike);
    values.set(key, (values.get(key) ?? 0) + cell.netGex);
  }
  for (const [key, value] of values) {
    const strike = Number(key.split("|")[1]);
    totals.set(String(strike), (totals.get(String(strike)) ?? 0) + value);
  }
  let strikes = [...totals.entries()].filter(([, value]) => value !== 0).map(([strike]) => Number(strike));
  // Keep the rows nearest spot when the band holds more strikes than fit.
  if (spot > 0 && strikes.length > rows) strikes = strikes.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot)).slice(0, rows);
  strikes.sort((a, b) => b - a);
  const max = Math.max(0, ...[...values.values()].map((value) => Math.abs(value)));
  const spotStrike = spot > 0 && strikes.length ? strikes.reduce((best, strike) => (Math.abs(strike - spot) < Math.abs(best - spot) ? strike : best), strikes[0]) : null;
  return { expiries, strikes, values, max, spotStrike, totals };
}

/** Square-root scale so a few huge cells do not wash out the rest. */
export function heatAlpha(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value) || value === 0) return 0;
  return Math.min(0.9, 0.08 + Math.sqrt(Math.abs(value) / max) * 0.82);
}

/** Latest New York session in a set of ISO times, and the points inside it. */
export function sessionSlice<T extends { time: string }>(points: T[]): T[] {
  if (points.length === 0) return points;
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));
  const last = day(points[points.length - 1].time);
  return points.filter((point) => day(point.time) === last);
}

/** Short cell label: 1.2B, 345M, 12K. */
export function shortGex(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
  return `${sign}${Math.round(abs)}`;
}
