export type IvPoint = [string, number, number | null];

export interface IvUpdate {
  sym: string;
  date: string;
  iv30: number;
  close: number | null;
}

/** Cboe iv30 arrives as a percent (14.8). Contract IV arrives as a decimal (0.148). */
export function asDecimalVol(value: number): number {
  if (!Number.isFinite(value) || value < 0) return NaN;
  return value > 3 ? value / 100 : value;
}

export function ivRank(history: number[]): number | null {
  if (history.length < 20) return null;
  const window = history.slice(-252);
  const low = Math.min(...window);
  const high = Math.max(...window);
  if (high === low) return null;
  return (window[window.length - 1] - low) / (high - low);
}

export function ivPercentile(history: number[]): number | null {
  if (history.length < 20) return null;
  const window = history.slice(-252);
  const last = window[window.length - 1];
  return window.filter((value) => value <= last).length / window.length;
}

export function rankLabel(history: number[]): string {
  if (history.length < 20) return `building: ${history.length}/252 sessions`;
  const rank = ivRank(history);
  return rank == null ? "flat history" : `${(rank * 100).toFixed(0)}`;
}

export function closeToCloseVol(closes: number[], window: number): number | null {
  if (window < 2 || closes.length <= window) return null;
  const slice = closes.slice(-(window + 1));
  const returns: number[] = [];
  for (let index = 1; index < slice.length; index += 1) {
    if (slice[index - 1] <= 0 || slice[index] <= 0) return null;
    returns.push(Math.log(slice[index] / slice[index - 1]));
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252);
}

export interface Ohlc {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Yang-Zhang annualized volatility. Needs at least `period + 1` bars. */
export function yangZhang(bars: Ohlc[], period = 20): number | null {
  if (period < 2 || bars.length < period + 1) return null;
  const slice = bars.slice(-(period + 1));
  const overnight: number[] = [];
  const openClose: number[] = [];
  const rogers: number[] = [];
  for (let index = 1; index < slice.length; index += 1) {
    const previous = slice[index - 1];
    const bar = slice[index];
    if (previous.close <= 0 || bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) return null;
    overnight.push(Math.log(bar.open / previous.close));
    openClose.push(Math.log(bar.close / bar.open));
    rogers.push(Math.log(bar.high / bar.close) * Math.log(bar.high / bar.open) + Math.log(bar.low / bar.close) * Math.log(bar.low / bar.open));
  }
  const variance = (values: number[]) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  };
  const n = overnight.length;
  const k = 0.34 / (1.34 + (n + 1) / (n - 1));
  const sigma = variance(overnight) + k * variance(openClose) + (1 - k) * (rogers.reduce((sum, value) => sum + value, 0) / (n - 1));
  if (!Number.isFinite(sigma) || sigma < 0) return null;
  return Math.sqrt(sigma * 252);
}

export function varianceRiskPremium(iv30: number | null, hv20: number | null): number | null {
  if (iv30 == null || hv20 == null) return null;
  const iv = asDecimalVol(iv30);
  if (!Number.isFinite(iv)) return null;
  return iv - hv20;
}

export function appendIvHistory(previous: Record<string, IvPoint[]> | null | undefined, rows: IvUpdate[], cap = 400): Record<string, IvPoint[]> {
  const book: Record<string, IvPoint[]> = {};
  for (const [symbol, points] of Object.entries(previous ?? {})) {
    book[symbol] = points.filter((point) => Array.isArray(point) && typeof point[0] === "string").slice(-cap);
  }
  for (const row of rows) {
    const iv = asDecimalVol(row.iv30);
    if (!row.sym || !row.date || !Number.isFinite(iv)) continue;
    const next = (book[row.sym] ?? []).filter((point) => point[0] !== row.date);
    next.push([row.date, iv, row.close]);
    next.sort((a, b) => a[0].localeCompare(b[0]));
    book[row.sym] = next.slice(-cap);
  }
  return book;
}
