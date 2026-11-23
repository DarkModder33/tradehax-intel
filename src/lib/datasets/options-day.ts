/**
 * One row per symbol per session from a delayed Cboe chain: option volume and premium by
 * side, dealer net gamma at spot, and the gamma flip level. Self-contained (no path
 * aliases) so the Node data job can import it with --experimental-strip-types.
 */

export interface DayContract {
  right: "call" | "put";
  strike: number;
  expiry: string;
  iv: number;
  gamma: number;
  openInterest: number;
  volume: number;
  last: number;
}

export interface OptionsDay {
  date: string;
  spot: number;
  callVolume: number | null;
  putVolume: number | null;
  callPremium: number | null;
  putPremium: number | null;
  netGex: number | null;
  flip: number | null;
  regime: "long" | "short" | null;
  asOf: string | null;
}

export type OptionsSeries = Record<string, OptionsDay[]>;

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function bsGamma(spot: number, strike: number, years: number, sigma: number): number {
  if (!(spot > 0 && strike > 0 && years > 0 && sigma > 0)) return 0;
  const d1 = (Math.log(spot / strike) + 0.5 * sigma * sigma * years) / (sigma * Math.sqrt(years));
  return Math.exp(-0.5 * d1 * d1) / SQRT_2PI / (spot * sigma * Math.sqrt(years));
}

function years(expiry: string, asOf: Date): number {
  const close = Date.parse(`${expiry}T21:00:00Z`);
  return Number.isFinite(close) ? Math.max(0, (close - asOf.getTime()) / (365 * 86_400_000)) : 0;
}

/** Dealer net gamma per 1% move at a spot, naive sign: calls long, puts short. */
export function netGexAt(contracts: DayContract[], spot: number, asOf: Date): number {
  let net = 0;
  for (const contract of contracts) {
    const gamma = bsGamma(spot, contract.strike, years(contract.expiry, asOf), contract.iv);
    net += (contract.right === "call" ? 1 : -1) * gamma * contract.openInterest * 100 * spot * spot * 0.01;
  }
  return net;
}

/** Nearest spot to the current one where net gamma crosses zero, within ±15%. */
export function flipLevel(contracts: DayContract[], spot: number, asOf: Date, step = 0.005): number | null {
  const near = contracts.filter((contract) => contract.openInterest > 0 && contract.iv > 0 && years(contract.expiry, asOf) > 0);
  if (near.length === 0 || !(spot > 0)) return null;
  let previous: { spot: number; net: number } | null = null;
  const crosses: number[] = [];
  for (let ratio = 0.85; ratio <= 1.15001; ratio += step) {
    const at = spot * ratio;
    const net = netGexAt(near, at, asOf);
    if (previous && previous.net !== 0 && previous.net * net < 0) {
      const weight = Math.abs(previous.net) / (Math.abs(previous.net) + Math.abs(net));
      crosses.push(previous.spot + (at - previous.spot) * weight);
    }
    previous = { spot: at, net };
  }
  return crosses.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0] ?? null;
}

/** Session summary. Volume and premium stay null when the feed carries no volume (Alpaca fallback). */
export function optionsDay(contracts: DayContract[], spot: number, date: string, asOf: Date, stamp: string | null = null): OptionsDay | null {
  if (!(spot > 0) || contracts.length === 0) return null;
  let callVolume = 0;
  let putVolume = 0;
  let callPremium = 0;
  let putPremium = 0;
  for (const contract of contracts) {
    const volume = Number.isFinite(contract.volume) ? contract.volume : 0;
    const premium = volume * (Number.isFinite(contract.last) ? contract.last : 0) * 100;
    if (contract.right === "call") {
      callVolume += volume;
      callPremium += premium;
    } else {
      putVolume += volume;
      putPremium += premium;
    }
  }
  const hasVolume = callVolume + putVolume > 0;
  const live = contracts.filter((contract) => contract.openInterest > 0 && contract.iv > 0);
  const netGex = live.length ? netGexAt(live, spot, asOf) : null;
  return {
    date,
    spot,
    callVolume: hasVolume ? callVolume : null,
    putVolume: hasVolume ? putVolume : null,
    callPremium: hasVolume ? Math.round(callPremium) : null,
    putPremium: hasVolume ? Math.round(putPremium) : null,
    netGex: netGex == null || netGex === 0 ? null : Math.round(netGex),
    flip: live.length ? flipLevel(live, spot, asOf) : null,
    regime: netGex == null || netGex === 0 ? null : netGex > 0 ? "long" : "short",
    asOf: stamp,
  };
}

/** Replaces the same session's row and keeps the last `keep` sessions per symbol. */
export function appendOptionsDays(series: OptionsSeries | null | undefined, updates: Array<{ symbol: string; day: OptionsDay }>, keep = 40): OptionsSeries {
  const next: OptionsSeries = {};
  for (const [symbol, rows] of Object.entries(series ?? {})) next[symbol] = Array.isArray(rows) ? [...rows] : [];
  for (const { symbol, day } of updates) {
    const rows = (next[symbol] ?? []).filter((row) => row.date !== day.date);
    rows.push(day);
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    next[symbol] = rows.slice(-keep);
  }
  return next;
}

const nyParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });

/** New York session date, or null on a weekend (the chain still shows Friday). */
export function sessionDate(now: Date): string | null {
  const parts = Object.fromEntries(nyParts.formatToParts(now).map((part) => [part.type, part.value]));
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return null;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toDayContracts(options: unknown[]): DayContract[] {
  const out: DayContract[] = [];
  for (const row of options ?? []) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const match = String(raw.option ?? "").toUpperCase().match(/(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
    if (!match) continue;
    const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
    out.push({
      right: match[4] === "C" ? "call" : "put",
      strike: Number(match[5]) / 1000,
      expiry: `20${match[1]}-${match[2]}-${match[3]}`,
      iv: num(raw.iv),
      gamma: num(raw.gamma),
      openInterest: num(raw.open_interest),
      volume: num(raw.volume),
      last: num(raw.last_trade_price),
    });
  }
  return out;
}
