/**
 * Machine alerts: one line per event, separate from the editorial news wire.
 * Self-contained (no path aliases) so the data job can import it with
 * `node --experimental-strip-types`.
 */

export const ALERT_TYPES = ["sweep", "block", "flow-spike", "gamma-flip", "insider", "short", "congress", "earnings", "mover"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSentiment = "Bullish" | "Bearish" | "Neutral";

export interface Alert {
  id: string;
  /** When the event happened (print time, filing date, session close). ISO. */
  at: string;
  /** When the generator first saw it. ISO. Set on merge. */
  seenAt?: string;
  ticker: string;
  type: AlertType;
  label: string;
  value: string;
  detail: string;
  sentiment: AlertSentiment;
  source: string;
  href: string;
  /** Dollar premium for tape alerts; used to rank and gate social posts. */
  amount?: number;
}

export const ALERT_LABELS: Record<AlertType, string> = {
  sweep: "Sweeps",
  block: "Blocks",
  "flow-spike": "Flow spikes",
  "gamma-flip": "Gamma flips",
  insider: "Insider clusters",
  short: "Short interest",
  congress: "Congress",
  earnings: "Earnings vs implied",
  mover: "Big movers",
};

export const ALERT_RULES = {
  sweepMinPremium: 250_000,
  blockMinPremium: 500_000,
  flowSpikeRatio: 2.5,
  flowSpikeMinContracts: 250_000,
  flowSpikeMinSessions: 5,
  gammaMinAbs: 50_000_000,
  insiderWindowDays: 14,
  insiderMinOwners: 2,
  shortMinChangePct: 15,
  shortMaxAgeDays: 30,
  congressMaxAgeDays: 5,
  congressMinLow: 15_001,
  earningsMinGap: 0.02,
  earningsMaxAgeDays: 4,
  moverMinPct: 4,
} as const;

const TICKER = /^[A-Z][A-Z0-9.]{0,9}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits: number): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  const [whole, frac = ""] = String(Math.abs(rounded)).split(".");
  const body = digits > 0 ? `${whole}.${frac.padEnd(digits, "0").slice(0, digits)}` : whole;
  return `${rounded < 0 ? "-" : ""}${body}`;
}

/** $2.1M, $850K, $1.2B. */
export function money(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${round(abs / 1e9, 1)}B`;
  if (abs >= 1e6) return `${sign}$${round(abs / 1e6, 1)}M`;
  if (abs >= 1e3) return `${sign}$${round(abs / 1e3, 0)}K`;
  return `${sign}$${round(abs, 0)}`;
}

export function signedPct(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${round(value, digits)}%`;
}

function strikeText(strike: number): string {
  return Number.isInteger(strike) ? String(strike) : round(strike, 2).replace(/0$/, "");
}

/** "Mar 150C", or "Dec 4 635P" when the expiry is within 45 days. */
export function contractText(expiry: string, strike: number, right: "call" | "put", now = new Date()): string {
  const [year, month, day] = expiry.split("-").map(Number);
  const at = Date.UTC(year, month - 1, day);
  const near = at - now.getTime() < 45 * 86_400_000;
  const head = near ? `${MONTHS[month - 1]} ${day}` : `${MONTHS[month - 1]}${year !== now.getUTCFullYear() ? ` '${String(year).slice(2)}` : ""}`;
  return `${head} ${strikeText(strike)}${right === "call" ? "C" : "P"}`;
}

function cap(sentiment: unknown): AlertSentiment {
  const text = String(sentiment ?? "").toLowerCase();
  return text === "bullish" ? "Bullish" : text === "bearish" ? "Bearish" : "Neutral";
}

function iso(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function dayIso(day: string, hourUtc = 21): string {
  return iso(`${day.slice(0, 10)}T${String(hourUtc).padStart(2, "0")}:00:00Z`);
}

export interface PrintLike {
  time: string;
  contract: string;
  root: string;
  expiry: string;
  strike: number;
  right: "call" | "put";
  side?: string;
  size: number;
  premium: number;
  sentiment?: string;
  flags?: string[];
}

/** Sweeps and blocks from the worker tape. Multi-leg prints are skipped: their direction is unknown. */
export function flowAlerts(prints: PrintLike[], now = new Date()): Alert[] {
  const out: Alert[] = [];
  for (const print of prints) {
    const flags = print.flags ?? [];
    if (flags.includes("multileg")) continue;
    const sweep = flags.includes("sweep");
    const block = flags.includes("block");
    const premium = num(print.premium);
    if (premium == null) continue;
    let type: AlertType | null = null;
    if (sweep && premium >= ALERT_RULES.sweepMinPremium) type = "sweep";
    else if (block && premium >= ALERT_RULES.blockMinPremium) type = "block";
    if (!type) continue;
    const right = print.right === "put" ? "put" : "call";
    const sideText = print.side === "ASK" ? "at ask" : print.side === "BID" ? "at bid" : "mid";
    out.push({
      id: `${type}|${print.contract}|${print.time}`,
      at: iso(print.time),
      ticker: String(print.root).toUpperCase(),
      type,
      label: `${right === "call" ? "Call" : "Put"} ${type}`,
      value: money(premium),
      detail: `${contractText(print.expiry, print.strike, right, now)} ×${Math.round(print.size)} ${sideText}`,
      sentiment: cap(print.sentiment),
      source: "Alpaca options tape via worker, about 15 min delayed",
      href: `/flow/?symbol=${encodeURIComponent(print.root)}`,
      amount: premium,
    });
  }
  return out;
}

interface OptionsDay {
  date: string;
  spot?: number;
  callVolume?: number;
  putVolume?: number;
  callPremium?: number;
  putPremium?: number;
  netGex?: number;
  flip?: number | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Option-volume spikes and dealer gamma sign flips from the daily options history. */
export function optionsAlerts(series: Record<string, OptionsDay[]>): Alert[] {
  const out: Alert[] = [];
  for (const [ticker, rows] of Object.entries(series ?? {})) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const today = rows[rows.length - 1];
    const total = (row: OptionsDay) => {
      const calls = num(row.callVolume);
      const puts = num(row.putVolume);
      return calls != null && puts != null && calls + puts > 0 ? calls + puts : null;
    };
    const volume = total(today);
    const prior = rows.slice(0, -1).slice(-20).map(total).filter((value): value is number => value != null && value > 0);
    if (volume != null && prior.length >= ALERT_RULES.flowSpikeMinSessions && volume >= ALERT_RULES.flowSpikeMinContracts) {
      const ratio = volume / median(prior);
      if (ratio >= ALERT_RULES.flowSpikeRatio) {
        const calls = num(today.callVolume) ?? 0;
        const share = calls / volume;
        out.push({
          id: `flow-spike|${ticker}|${today.date}`,
          at: dayIso(today.date),
          ticker,
          type: "flow-spike",
          label: "Volume spike",
          value: `${round(ratio, 1)}x avg`,
          detail: `${round(volume / 1e6, 2)}M contracts, ${round(share * 100, 0)}% calls`,
          sentiment: share >= 0.6 ? "Bullish" : share <= 0.4 ? "Bearish" : "Neutral",
          source: "Cboe delayed option chain, daily",
          href: `/flow/?symbol=${ticker}`,
        });
      }
    }
    if (rows.length >= 2) {
      const before = rows[rows.length - 2];
      const prev = num(before.netGex);
      const next = num(today.netGex);
      const gap = (Date.parse(`${today.date}T00:00:00Z`) - Date.parse(`${before.date}T00:00:00Z`)) / 86_400_000;
      if (prev != null && next != null && prev !== 0 && next !== 0 && Math.sign(prev) !== Math.sign(next)
        && Math.abs(prev) >= ALERT_RULES.gammaMinAbs && Math.abs(next) >= ALERT_RULES.gammaMinAbs && gap > 0 && gap <= 4) {
        const flip = num(today.flip);
        out.push({
          id: `gamma-flip|${ticker}|${today.date}`,
          at: dayIso(today.date),
          ticker,
          type: "gamma-flip",
          label: next < 0 ? "Gamma flip short" : "Gamma flip long",
          value: `${money(next)}/1%`,
          detail: flip != null ? `flip ${round(flip, 2)}, spot ${round(num(today.spot) ?? 0, 2)}` : `spot ${round(num(today.spot) ?? 0, 2)}`,
          sentiment: next < 0 ? "Bearish" : "Bullish",
          source: "Cboe delayed option chain, open-interest gamma",
          href: `/gex/?s=${ticker}`,
        });
      }
    }
  }
  return out;
}

interface InsiderRow {
  filed?: string;
  trade?: { owner?: string; ticker?: string; code?: string; shares?: number; price?: number; acquired?: boolean };
}

/** Two or more distinct insiders buying on the open market within the window. */
export function insiderAlerts(rows: InsiderRow[], today: string): Alert[] {
  const groups = new Map<string, { owner: string; dollars: number; filed: string }[]>();
  const todayAt = Date.parse(`${today}T00:00:00Z`);
  for (const row of rows ?? []) {
    const trade = row.trade ?? {};
    const ticker = String(trade.ticker ?? "").toUpperCase();
    const shares = num(trade.shares);
    const price = num(trade.price);
    const filed = String(row.filed ?? "").slice(0, 10);
    if (!TICKER.test(ticker) || trade.code !== "P" || trade.acquired === false || !(shares && shares > 0) || !(price && price > 0)) continue;
    const filedAt = Date.parse(`${filed}T00:00:00Z`);
    if (!Number.isFinite(filedAt) || todayAt - filedAt > ALERT_RULES.insiderWindowDays * 86_400_000) continue;
    const bucket = groups.get(ticker) ?? [];
    bucket.push({ owner: trade.owner ?? "?", dollars: shares * price, filed });
    groups.set(ticker, bucket);
  }
  const out: Alert[] = [];
  for (const [ticker, trades] of groups) {
    const owners = new Set(trades.map((trade) => trade.owner));
    if (owners.size < ALERT_RULES.insiderMinOwners) continue;
    const latest = trades.map((trade) => trade.filed).sort().at(-1) ?? today;
    out.push({
      id: `insider|${ticker}|${latest}`,
      at: dayIso(latest),
      ticker,
      type: "insider",
      label: "Insider buying",
      value: money(trades.reduce((sum, trade) => sum + trade.dollars, 0)),
      detail: `${owners.size} insiders, ${trades.length} Form 4s`,
      sentiment: "Bullish",
      source: "SEC EDGAR Form 4",
      href: `/insiders/?s=${ticker}`,
    });
  }
  return out;
}

interface ShortRow {
  symbolCode?: string;
  changePercent?: number;
  settlementDate?: string;
  daysToCoverQuantity?: number;
  currentShortPositionQuantity?: number;
}

export function shortAlerts(rows: ShortRow[], today: string): Alert[] {
  const out: Alert[] = [];
  const todayAt = Date.parse(`${today}T00:00:00Z`);
  for (const row of rows ?? []) {
    const ticker = String(row.symbolCode ?? "").toUpperCase();
    const change = num(row.changePercent);
    const settled = String(row.settlementDate ?? "").slice(0, 10);
    const settledAt = Date.parse(`${settled}T00:00:00Z`);
    if (!TICKER.test(ticker) || change == null || Math.abs(change) < ALERT_RULES.shortMinChangePct) continue;
    if (!Number.isFinite(settledAt) || todayAt - settledAt > ALERT_RULES.shortMaxAgeDays * 86_400_000) continue;
    const days = num(row.daysToCoverQuantity);
    out.push({
      id: `short|${ticker}|${settled}`,
      at: dayIso(settled),
      ticker,
      type: "short",
      label: change > 0 ? "Short interest up" : "Short interest down",
      value: signedPct(change),
      detail: `settled ${settled.slice(5)}${days != null ? `, ${round(days, 1)} days to cover` : ""}`,
      sentiment: change > 0 ? "Bearish" : "Bullish",
      source: "FINRA consolidated short interest",
      href: `/shorts/?s=${ticker}`,
    });
  }
  return out;
}

interface CongressRow {
  ticker?: string;
  type?: string;
  member?: string;
  party?: string;
  chamber?: string;
  amount?: string;
  amountLow?: number;
  transactionDate?: string;
  filed?: string;
  docId?: string;
}

const SUFFIX = /^(jr|sr|ii|iii|iv|v|md|phd)\.?$/i;

function lastName(member: string): string {
  const parts = member.replace(/,.*$/, "").replace(/^(hon\.?|rep\.?|sen\.?)\s+/i, "").trim().split(/\s+/).filter((part) => !SUFFIX.test(part));
  return parts[parts.length - 1] ?? member;
}

export function congressAlerts(rows: CongressRow[], today: string): Alert[] {
  const out: Alert[] = [];
  const todayAt = Date.parse(`${today}T00:00:00Z`);
  for (const row of rows ?? []) {
    const ticker = String(row.ticker ?? "").toUpperCase();
    const filed = String(row.filed ?? "").slice(0, 10);
    const filedAt = Date.parse(`${filed}T00:00:00Z`);
    const low = num(row.amountLow) ?? 0;
    if (!TICKER.test(ticker) || !Number.isFinite(filedAt) || todayAt - filedAt > ALERT_RULES.congressMaxAgeDays * 86_400_000) continue;
    if (low < ALERT_RULES.congressMinLow) continue;
    const kind = String(row.type ?? "").toLowerCase();
    const buy = kind.startsWith("purchase") || kind === "p";
    const sell = kind.includes("sale") || kind === "s";
    if (!buy && !sell) continue;
    const party = String(row.party ?? "").slice(0, 1).toUpperCase();
    out.push({
      id: `congress|${row.docId ?? "?"}|${ticker}|${row.transactionDate ?? ""}|${buy ? "buy" : "sell"}|${low}`,
      at: dayIso(filed),
      ticker,
      type: "congress",
      label: buy ? "Congress buy" : "Congress sale",
      value: String(row.amount ?? money(low)).replace(/\s+/g, " "),
      detail: `${lastName(String(row.member ?? "?"))}${party ? ` (${party})` : ""}, traded ${String(row.transactionDate ?? "").slice(5)}`,
      sentiment: buy ? "Bullish" : "Bearish",
      source: "House Clerk periodic transaction reports",
      href: `/congress/?ticker=${ticker}`,
    });
  }
  return out;
}

interface EarningsRowLike {
  sym?: string;
  reportDate?: string;
  afterDate?: string;
  realized?: number | null;
  implied?: number | null;
}

export function earningsAlerts(rows: EarningsRowLike[], today: string): Alert[] {
  const out: Alert[] = [];
  const todayAt = Date.parse(`${today}T00:00:00Z`);
  for (const row of rows ?? []) {
    const ticker = String(row.sym ?? "").toUpperCase();
    const realized = num(row.realized);
    const implied = num(row.implied);
    const after = String(row.afterDate ?? "").slice(0, 10);
    const afterAt = Date.parse(`${after}T00:00:00Z`);
    if (!TICKER.test(ticker) || realized == null || implied == null || !(implied > 0) || !Number.isFinite(afterAt)) continue;
    if (todayAt - afterAt > ALERT_RULES.earningsMaxAgeDays * 86_400_000) continue;
    const gap = Math.abs(realized) - Math.abs(implied);
    if (Math.abs(gap) < ALERT_RULES.earningsMinGap) continue;
    out.push({
      id: `earnings|${ticker}|${row.reportDate}`,
      at: dayIso(after),
      ticker,
      type: "earnings",
      label: gap > 0 ? "Earnings beat implied" : "Earnings under implied",
      value: signedPct(realized * 100),
      detail: `implied ±${round(implied * 100, 1)}%, reported ${String(row.reportDate ?? "").slice(5)}`,
      sentiment: realized > 0 ? "Bullish" : realized < 0 ? "Bearish" : "Neutral",
      source: "Nasdaq report dates, Alpaca closes, Cboe/Alpaca straddles",
      href: `/earnings/?s=${ticker}`,
    });
  }
  return out;
}

export interface DailyCloses {
  ticker: string;
  date: string;
  close: number;
  previous: number;
  volumeRatio?: number | null;
}

export function moverAlerts(rows: DailyCloses[]): Alert[] {
  const out: Alert[] = [];
  for (const row of rows ?? []) {
    if (!TICKER.test(row.ticker) || !(row.previous > 0) || !(row.close > 0)) continue;
    const pct = ((row.close - row.previous) / row.previous) * 100;
    if (Math.abs(pct) < ALERT_RULES.moverMinPct) continue;
    out.push({
      id: `mover|${row.ticker}|${row.date}`,
      at: dayIso(row.date),
      ticker: row.ticker,
      type: "mover",
      label: pct > 0 ? "Big gainer" : "Big decliner",
      value: signedPct(pct),
      detail: `close ${round(row.close, 2)}${row.volumeRatio ? `, ${round(row.volumeRatio, 1)}x volume` : ""}`,
      sentiment: pct > 0 ? "Bullish" : "Bearish",
      source: "Alpaca SIP daily bars via worker",
      href: `/t/?s=${row.ticker}`,
    });
  }
  return out;
}

/** Reasons an alert must not be shown or posted. Empty means it passes. */
export function validateAlert(alert: Partial<Alert>, now = new Date(), maxAgeDays = 35): string[] {
  const reasons: string[] = [];
  if (!alert.id) reasons.push("no id");
  if (!alert.ticker || !TICKER.test(alert.ticker)) reasons.push("bad ticker");
  if (!alert.type || !(ALERT_TYPES as readonly string[]).includes(alert.type)) reasons.push("bad type");
  if (!alert.label?.trim()) reasons.push("no label");
  if (!alert.value?.trim() || /NaN|undefined|null|Infinity/.test(alert.value)) reasons.push("bad value");
  if (/NaN|undefined|Infinity/.test(alert.detail ?? "")) reasons.push("bad detail");
  if (!alert.sentiment || !["Bullish", "Bearish", "Neutral"].includes(alert.sentiment)) reasons.push("bad sentiment");
  const at = Date.parse(alert.at ?? "");
  if (!Number.isFinite(at)) reasons.push("no time");
  else if (at - now.getTime() > 6 * 3_600_000) reasons.push("in the future");
  else if (now.getTime() - at > maxAgeDays * 86_400_000) reasons.push("stale");
  return reasons;
}

/** Merge new alerts into the stored feed: keep first-seen times, drop old and invalid ones, newest first. */
export function mergeAlerts(previous: Alert[], next: Alert[], now = new Date(), keepDays = 7, limit = 600): Alert[] {
  const byId = new Map<string, Alert>();
  for (const alert of previous ?? []) if (alert?.id) byId.set(alert.id, alert);
  const stamp = now.toISOString();
  for (const alert of next) {
    const prior = byId.get(alert.id);
    byId.set(alert.id, { ...alert, seenAt: prior?.seenAt ?? stamp });
  }
  return [...byId.values()]
    .filter((alert) => validateAlert(alert, now).length === 0 && now.getTime() - Date.parse(alert.seenAt ?? alert.at) <= keepDays * 86_400_000)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? -1 : 1))
    .slice(0, limit);
}

/** "15:42" in New York for intraday events, "Nov 21" for daily ones. */
export function alertTime(alert: Pick<Alert, "at" | "type">): string {
  const date = new Date(alert.at);
  if (Number.isNaN(date.getTime())) return "--:--";
  if (alert.type === "sweep" || alert.type === "block") {
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(date);
}

/** One compact line, e.g. "15:42 NVDA  Call sweep  $2.1M  Mar 150C ×400 at ask  Bullish". */
export function formatAlertLine(alert: Alert): string {
  return [`${alertTime(alert)} ${alert.ticker}`, alert.label, alert.value, alert.detail, alert.sentiment].filter(Boolean).join("  ");
}
