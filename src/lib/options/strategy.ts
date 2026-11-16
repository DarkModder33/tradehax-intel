import type { ChainContract, ChainSnapshot } from "@/lib/sources/cboe";
import { bsDelta, bsGamma, bsPrice, bsTheta, bsVega, yearFraction } from "./bs";
import { normalCdf } from "@/lib/stats/normal";

export interface StrategyLeg {
  right: "call" | "put";
  side: 1 | -1;
  strike: number;
  premium: number;
  quantity: number;
  expiry?: string;
  iv?: number;
  symbol?: string;
  bid?: number;
  ask?: number;
}

export interface StockHedge {
  shares: number;
  entry: number;
}

export interface StrategyPoint {
  spot: number;
  pnl: number;
}

export function legPayoff(leg: StrategyLeg, spot: number): number {
  const intrinsic = leg.right === "call" ? Math.max(0, spot - leg.strike) : Math.max(0, leg.strike - spot);
  return leg.side * leg.quantity * (intrinsic - leg.premium) * 100;
}

export function strategyCurve(legs: StrategyLeg[], spots: number[]): StrategyPoint[] {
  return spots.map((spot) => ({
    spot,
    pnl: legs.reduce((sum, leg) => sum + legPayoff(leg, spot), 0),
  }));
}

export function breakevens(curve: StrategyPoint[]): number[] {
  const points: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const left = curve[i - 1];
    const right = curve[i];
    if (left.pnl === 0) points.push(left.spot);
    else if (left.pnl * right.pnl < 0) {
      const weight = Math.abs(left.pnl) / (Math.abs(left.pnl) + Math.abs(right.pnl));
      points.push(left.spot + (right.spot - left.spot) * weight);
    }
  }
  return points;
}

/** Risk-neutral chance the terminal spot lands where P/L is positive. Rate is zero. */
export function probabilityOfProfit(curve: StrategyPoint[], spot: number, sigma: number, timeYears: number): number | null {
  if (sigma <= 0 || timeYears <= 0 || spot <= 0) return null;
  const width = curve.length > 1 ? curve[1].spot - curve[0].spot : 1;
  let probability = 0;
  for (const point of curve) {
    if (point.pnl <= 0) continue;
    const z = (Math.log(point.spot / spot) + 0.5 * sigma * sigma * timeYears) / (sigma * Math.sqrt(timeYears));
    const density = Math.exp(-0.5 * z * z) / (point.spot * sigma * Math.sqrt(timeYears) * Math.sqrt(2 * Math.PI));
    probability += density * width;
  }
  return Math.min(1, Math.max(0, probability));
}

/** Model expected P/L on the same risk-neutral grid as the probability of profit. */
export function expectedValue(curve: StrategyPoint[], spot: number, sigma: number, timeYears: number): number | null {
  if (sigma <= 0 || timeYears <= 0 || spot <= 0) return null;
  const width = curve.length > 1 ? curve[1].spot - curve[0].spot : 1;
  let value = 0;
  for (const point of curve) {
    const z = (Math.log(point.spot / spot) + 0.5 * sigma * sigma * timeYears) / (sigma * Math.sqrt(timeYears));
    const density = Math.exp(-0.5 * z * z) / (point.spot * sigma * Math.sqrt(timeYears) * Math.sqrt(2 * Math.PI));
    value += point.pnl * density * width;
  }
  return value;
}

export function callDeltaCheck(spot: number, strike: number, sigma: number, timeYears: number): number {
  const d2 = (Math.log(spot / strike) - 0.5 * sigma * sigma * timeYears) / (sigma * Math.sqrt(timeYears));
  return normalCdf(d2);
}

function signedQuantity(legs: StrategyLeg[], right: "call" | "put"): number {
  return legs.filter((leg) => leg.right === right).reduce((sum, leg) => sum + leg.side * leg.quantity, 0);
}

/** Mark-to-model P/L for one leg. After expiry the value is intrinsic. */
export function legValueAt(leg: StrategyLeg, spot: number, asOf: Date, ivShift = 0): number {
  const expiry = leg.expiry ?? asOf.toISOString().slice(0, 10);
  const time = yearFraction(expiry, asOf);
  const sigma = Math.max(0, (leg.iv ?? 0) + ivShift);
  const price = time <= 0 || sigma <= 0
    ? (leg.right === "call" ? Math.max(0, spot - leg.strike) : Math.max(0, leg.strike - spot))
    : bsPrice({ spot, strike: leg.strike, timeYears: time, sigma, right: leg.right });
  return leg.side * leg.quantity * (price - leg.premium) * 100;
}

export function bookValue(legs: StrategyLeg[], hedge: StockHedge | null, spot: number, asOf: Date, ivShift = 0): number {
  const options = legs.reduce((sum, leg) => sum + legValueAt(leg, spot, asOf, ivShift), 0);
  const stock = hedge ? hedge.shares * (spot - hedge.entry) : 0;
  return options + stock;
}

export interface ProfitLoss {
  maxProfit: number | null;
  maxLoss: number | null;
  unboundedProfit: boolean;
  unboundedLoss: boolean;
}

/** Null means unlimited. Slope beyond the outer strikes decides that, before the grid search. */
export function maxProfitLoss(legs: StrategyLeg[], hedge: StockHedge | null = null): ProfitLoss {
  const calls = signedQuantity(legs, "call");
  const puts = signedQuantity(legs, "put");
  const covered = (hedge?.shares ?? 0) / 100;
  const upside = calls + covered;
  const unboundedProfit = upside > 1e-9;
  const unboundedLoss = upside < -1e-9 || puts < -1e-9;
  if (legs.length === 0 && !hedge) return { maxProfit: 0, maxLoss: 0, unboundedProfit: false, unboundedLoss: false };
  const strikes = legs.map((leg) => leg.strike);
  const low = 0;
  const high = Math.max(1, ...strikes) * 3;
  const steps = 240;
  let best = -Infinity;
  let worst = Infinity;
  const asOf = new Date("2100-01-01T00:00:00Z");
  for (let index = 0; index <= steps; index += 1) {
    const spot = low + ((high - low) * index) / steps;
    const pnl = bookValue(legs, hedge, spot, asOf, 0);
    best = Math.max(best, pnl);
    worst = Math.min(worst, pnl);
  }
  return {
    maxProfit: unboundedProfit ? null : best,
    maxLoss: unboundedLoss ? null : Math.abs(Math.min(0, worst)),
    unboundedProfit,
    unboundedLoss,
  };
}

export interface GreekDollars {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export function aggregateGreeks(legs: StrategyLeg[], spot: number, asOf: Date, ivShift = 0): GreekDollars {
  const totals = { delta: 0, gamma: 0, theta: 0, vega: 0 };
  for (const leg of legs) {
    const expiry = leg.expiry ?? asOf.toISOString().slice(0, 10);
    const timeYears = yearFraction(expiry, asOf);
    const sigma = Math.max(0, (leg.iv ?? 0) + ivShift);
    const input = { spot, strike: leg.strike, timeYears, sigma, right: leg.right };
    const sign = leg.side * leg.quantity * 100;
    totals.delta += sign * bsDelta(input) * spot;
    totals.gamma += sign * bsGamma(input) * spot * spot * 0.01;
    totals.theta += sign * bsTheta(input);
    totals.vega += sign * (bsVega(input) / 100);
  }
  return totals;
}

export function marginEstimate(legs: StrategyLeg[], hedge: StockHedge | null = null): { amount: number | null; label: "defined" | "estimate" } {
  const bounds = maxProfitLoss(legs, hedge);
  if (bounds.unboundedLoss || bounds.maxLoss == null) return { amount: null, label: "estimate" };
  return { amount: bounds.maxLoss, label: "defined" };
}

export const PRESETS = [
  "long-call",
  "long-put",
  "vertical",
  "straddle",
  "strangle",
  "iron-condor",
  "iron-fly",
  "butterfly",
  "calendar",
  "diagonal",
  "covered-call",
  "cash-secured-put",
  "collar",
  "ratio",
  "jade-lizard",
] as const;

export type PresetKind = (typeof PRESETS)[number];

function mid(contract: ChainContract | undefined): number {
  if (!contract) return 0;
  if (contract.bid > 0 && contract.ask > 0) return (contract.bid + contract.ask) / 2;
  return contract.last || contract.theo;
}

function listed(chain: ChainSnapshot, expiry: string): ChainContract[] {
  return chain.contracts.filter((contract) => contract.expiry === expiry);
}

export function nearestStrike(strikes: number[], spot: number): number | null {
  if (!strikes.length || !(spot > 0)) return null;
  return [...strikes].sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot) || a - b)[0];
}

function contractAt(rows: ChainContract[], right: "call" | "put", strike: number): ChainContract | undefined {
  return rows.find((contract) => contract.right === right && contract.strike === strike);
}

function fromContract(contract: ChainContract, side: 1 | -1, price = mid(contract)): StrategyLeg {
  return {
    right: contract.right,
    side,
    strike: contract.strike,
    premium: price,
    quantity: 1,
    expiry: contract.expiry,
    iv: contract.iv,
    symbol: contract.symbol,
  };
}

export interface PresetBook {
  legs: StrategyLeg[];
  hedge: StockHedge | null;
}

/** Build a structure around the money. Missing wings come back as fewer legs, never invented prices. */
export function presetLegs(chain: ChainSnapshot, expiry: string, kind: PresetKind, backExpiry?: string): PresetBook {
  const rows = listed(chain, expiry);
  const strikes = [...new Set(rows.map((contract) => contract.strike))].sort((a, b) => a - b);
  const atm = nearestStrike(strikes, chain.spot);
  if (atm == null) return { legs: [], hedge: null };
  const index = strikes.indexOf(atm);
  const lower = strikes[Math.max(0, index - 1)];
  const upper = strikes[Math.min(strikes.length - 1, index + 1)];
  const furtherPut = strikes[Math.max(0, index - 2)];
  const furtherCall = strikes[Math.min(strikes.length - 1, index + 2)];
  const call = contractAt(rows, "call", atm);
  const put = contractAt(rows, "put", atm);
  const buy = (contract: ChainContract | undefined) => (contract ? [fromContract(contract, 1)] : []);
  const sell = (contract: ChainContract | undefined) => (contract ? [fromContract(contract, -1)] : []);
  if (kind === "long-call") return { legs: buy(call), hedge: null };
  if (kind === "long-put") return { legs: buy(put), hedge: null };
  if (kind === "vertical") return { legs: [...buy(call), ...sell(contractAt(rows, "call", upper))], hedge: null };
  if (kind === "straddle") return { legs: [...buy(call), ...buy(put)], hedge: null };
  if (kind === "strangle") return { legs: [...buy(contractAt(rows, "put", lower)), ...buy(contractAt(rows, "call", upper))], hedge: null };
  if (kind === "iron-condor") {
    return {
      legs: [
        ...buy(contractAt(rows, "put", furtherPut)),
        ...sell(contractAt(rows, "put", lower)),
        ...sell(contractAt(rows, "call", upper)),
        ...buy(contractAt(rows, "call", furtherCall)),
      ],
      hedge: null,
    };
  }
  if (kind === "iron-fly") {
    return {
      legs: [...buy(contractAt(rows, "put", lower)), ...sell(put), ...sell(call), ...buy(contractAt(rows, "call", upper))],
      hedge: null,
    };
  }
  if (kind === "butterfly") {
    const body = contractAt(rows, "call", atm);
    return {
      legs: [...buy(contractAt(rows, "call", lower)), ...(body ? [fromContract(body, -1), fromContract(body, -1)] : []), ...buy(contractAt(rows, "call", upper))],
      hedge: null,
    };
  }
  if (kind === "calendar" || kind === "diagonal") {
    const expiries = [...new Set(chain.contracts.map((contract) => contract.expiry))].sort();
    const back = backExpiry && expiries.includes(backExpiry) ? backExpiry : expiries.find((item) => item > expiry) ?? expiry;
    const backRows = listed(chain, back);
    const backStrike = kind === "diagonal" ? upper : atm;
    return {
      legs: [...sell(call), ...buy(contractAt(backRows, "call", backStrike))],
      hedge: null,
    };
  }
  if (kind === "covered-call") return { legs: sell(call), hedge: { shares: 100, entry: chain.spot } };
  if (kind === "cash-secured-put") return { legs: sell(put), hedge: null };
  if (kind === "collar") return { legs: [...buy(contractAt(rows, "put", lower)), ...sell(contractAt(rows, "call", upper))], hedge: { shares: 100, entry: chain.spot } };
  if (kind === "ratio") return { legs: [...buy(call), ...sell(contractAt(rows, "call", upper)), ...sell(contractAt(rows, "call", upper))], hedge: null };
  const jade = [
    ...sell(contractAt(rows, "put", lower)),
    ...sell(contractAt(rows, "call", upper)),
    ...buy(contractAt(rows, "call", furtherCall)),
  ];
  return { legs: jade, hedge: null };
}

export function encodeLegs(legs: StrategyLeg[], hedge: StockHedge | null = null): string {
  const json = JSON.stringify({ legs, hedge });
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeLegs(raw: string): { legs: StrategyLeg[]; hedge: StockHedge | null } | null {
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const parsed = JSON.parse(json) as { legs?: StrategyLeg[]; hedge?: StockHedge | null };
    if (!Array.isArray(parsed.legs)) return null;
    return { legs: parsed.legs, hedge: parsed.hedge ?? null };
  } catch {
    return null;
  }
}

export const PAPER_INBOX_KEY = "tradehax-paper-inbox";
