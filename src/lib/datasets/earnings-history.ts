/**
 * Earnings implied vs actual move history. Self-contained (no path aliases) so the Node
 * data job can import it with --experimental-strip-types.
 *
 * Actual move: close before the report date to the first close after it. That two-session
 * window holds the reaction whether the report came before the open or after the close.
 * Implied move: the at-the-money straddle for the first expiry after the report date,
 * divided by spot, priced on the close before the report.
 */

export interface Surprise {
  reportDate: string;
  fiscalQuarter: string;
  eps: number | null;
  consensus: number | null;
  surprisePct: number | null;
}

export interface DailyBar {
  time: number | string;
  close: number;
}

export interface WindowMove {
  beforeDate: string;
  afterDate: string;
  closeBefore: number;
  closeAfter: number;
  move: number;
}

export interface EarningsRow {
  sym: string;
  reportDate: string;
  fiscalQuarter: string | null;
  surprisePct: number | null;
  beforeDate: string;
  afterDate: string;
  closeBefore: number;
  closeAfter: number;
  /** Signed close-to-close move across the report, as a fraction. */
  realized: number;
  /** ATM straddle / spot before the report, as a fraction, or null when not captured. */
  implied: number | null;
  impliedSource: string | null;
  impliedExpiry: string | null;
}

export interface UpcomingRow {
  sym: string;
  reportDate: string;
  implied: number | null;
  impliedExpiry: string | null;
  spot: number | null;
  avgMove: number | null;
  samples: number;
  capturedAt: string;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function numberOr(value: unknown): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(String(value).replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function usDate(value: string): string | null {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}` : null;
}

export function parseSurprise(body: unknown): Surprise[] {
  const rows = (body as { data?: { earningsSurpriseTable?: { rows?: unknown[] } } })?.data?.earningsSurpriseTable?.rows;
  if (!Array.isArray(rows)) return [];
  const out: Surprise[] = [];
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const reportDate = usDate(String(row.dateReported ?? ""));
    if (!reportDate) continue;
    out.push({
      reportDate,
      fiscalQuarter: String(row.fiscalQtrEnd ?? "").trim(),
      eps: numberOr(row.eps),
      consensus: numberOr(row.consensusForecast),
      surprisePct: numberOr(row.percentageSurprise),
    });
  }
  return out;
}

/** "Earnings announcement* for NVDA: Feb 25, 2027" to 2027-02-25. */
export function parseUpcoming(body: unknown): string | null {
  const text = String((body as { data?: { announcement?: string } })?.data?.announcement ?? "");
  const match = text.match(/([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[2].padStart(2, "0")}` : null;
}

const nyDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

export function barDay(bar: DailyBar): string {
  const stamp = typeof bar.time === "number" ? bar.time : Date.parse(bar.time);
  return nyDay.format(new Date(stamp));
}

/** Close before the report date to the first close after it, with no more than `maxGap` days on either side. */
export function windowMove(bars: DailyBar[], reportDate: string, maxGap = 5): WindowMove | null {
  const days = bars
    .filter((bar) => Number.isFinite(bar?.close) && bar.close > 0)
    .map((bar) => ({ day: barDay(bar), close: bar.close }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  const before = [...days].reverse().find((row) => row.day < reportDate);
  const after = days.find((row) => row.day > reportDate);
  if (!before || !after) return null;
  const span = (Date.parse(`${after.day}T00:00:00Z`) - Date.parse(`${before.day}T00:00:00Z`)) / 86_400_000;
  if (span > maxGap * 2) return null;
  return { beforeDate: before.day, afterDate: after.day, closeBefore: before.close, closeAfter: after.close, move: after.close / before.close - 1 };
}

interface RawOption {
  option?: string;
  bid?: number;
  ask?: number;
  last_trade_price?: number;
}

function occParts(symbol: string) {
  const match = String(symbol).toUpperCase().match(/(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  return match ? { expiry: `20${match[1]}-${match[2]}-${match[3]}`, right: match[4], strike: Number(match[5]) / 1000 } : null;
}

/** ATM straddle mid / spot for the first expiry after the report date, from a Cboe chain. */
export function straddleImplied(options: RawOption[], spot: number, reportDate: string): { implied: number; expiry: string; strike: number } | null {
  if (!(spot > 0)) return null;
  const parsed = (options ?? [])
    .map((option) => ({ option, parts: occParts(String(option.option ?? "")) }))
    .filter((row): row is { option: RawOption; parts: NonNullable<ReturnType<typeof occParts>> } => row.parts != null && row.parts.expiry > reportDate);
  const expiry = [...new Set(parsed.map((row) => row.parts.expiry))].sort()[0];
  if (!expiry) return null;
  const listed = parsed.filter((row) => row.parts.expiry === expiry);
  const strikes = [...new Set(listed.map((row) => row.parts.strike))].sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot));
  const price = (option?: RawOption) => {
    if (!option) return 0;
    const bid = Number(option.bid);
    const ask = Number(option.ask);
    if (bid > 0 && ask > 0) return (bid + ask) / 2;
    return Number(option.last_trade_price) > 0 ? Number(option.last_trade_price) : 0;
  };
  for (const strike of strikes.slice(0, 3)) {
    const call = listed.find((row) => row.parts.strike === strike && row.parts.right === "C")?.option;
    const put = listed.find((row) => row.parts.strike === strike && row.parts.right === "P")?.option;
    const total = price(call) + price(put);
    if (price(call) > 0 && price(put) > 0) return { implied: total / spot, expiry, strike };
  }
  return null;
}

/** Fridays (and the Thursday before, for holiday weeks) after the report date. */
export function candidateExpiries(reportDate: string, weeks = 2): string[] {
  const out: string[] = [];
  const cursor = new Date(`${reportDate}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (out.length < weeks * 2) {
    const weekday = cursor.getUTCDay();
    if (weekday === 5) {
      const thursday = new Date(cursor.getTime() - 86_400_000).toISOString().slice(0, 10);
      if (thursday > reportDate) out.push(thursday);
      out.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...new Set(out)].slice(0, weeks * 2);
}

export function occSymbol(root: string, expiry: string, right: "C" | "P", strike: number): string {
  const [year, month, day] = expiry.split("-");
  return `${root.toUpperCase()}${year.slice(2)}${month}${day}${right}${String(Math.round(strike * 1000)).padStart(8, "0")}`;
}

/** Strikes near spot on the common listing grids. */
export function candidateStrikes(spot: number): number[] {
  const out = new Set<number>();
  for (const step of [1, 2.5, 5, 10]) {
    const base = Math.round(spot / step) * step;
    for (const offset of [-1, 0, 1]) out.add(Math.round((base + offset * step) * 100) / 100);
  }
  return [...out].filter((strike) => strike > 0).sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot));
}

/** Historical straddle from Alpaca daily option bars on the close-before date. */
export function straddleFromBars(bars: Record<string, Array<{ t: string; c: number }>>, beforeDate: string, spot: number): { implied: number; expiry: string; strike: number } | null {
  const closeOn = (symbol: string) => (bars[symbol] ?? []).find((bar) => String(bar.t).slice(0, 10) === beforeDate)?.c ?? null;
  const parsed = Object.keys(bars).map((symbol) => ({ symbol, parts: occParts(symbol) })).filter((row) => row.parts != null);
  const expiries = [...new Set(parsed.map((row) => row.parts!.expiry))].sort();
  for (const expiry of expiries) {
    const strikes = [...new Set(parsed.filter((row) => row.parts!.expiry === expiry).map((row) => row.parts!.strike))].sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot));
    for (const strike of strikes) {
      const call = parsed.find((row) => row.parts!.expiry === expiry && row.parts!.strike === strike && row.parts!.right === "C");
      const put = parsed.find((row) => row.parts!.expiry === expiry && row.parts!.strike === strike && row.parts!.right === "P");
      const c = call ? closeOn(call.symbol) : null;
      const p = put ? closeOn(put.symbol) : null;
      if (c != null && p != null && c > 0 && p > 0 && Math.abs(strike - spot) / spot < 0.05) return { implied: (c + p) / spot, expiry, strike };
    }
  }
  return null;
}

export function averageAbsMove(rows: Pick<EarningsRow, "realized">[]): number | null {
  const moves = rows.map((row) => Math.abs(row.realized)).filter((value) => Number.isFinite(value));
  return moves.length ? moves.reduce((sum, value) => sum + value, 0) / moves.length : null;
}

/** Prior rows win for implied (captured before the event); new rows win for everything else. */
export function mergeEarningsRows(prior: EarningsRow[], next: EarningsRow[]): EarningsRow[] {
  const map = new Map<string, EarningsRow>();
  for (const row of prior) map.set(`${row.sym}|${row.reportDate}`, row);
  for (const row of next) {
    const key = `${row.sym}|${row.reportDate}`;
    const old = map.get(key);
    map.set(key, old && old.implied != null && row.implied == null ? { ...row, implied: old.implied, impliedSource: old.impliedSource, impliedExpiry: old.impliedExpiry } : row);
  }
  return [...map.values()].sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : a.sym.localeCompare(b.sym)));
}
