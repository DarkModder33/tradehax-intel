import type { BarCall } from "@/lib/indicators/factors";
import type { Bar, Timeframe } from "@/lib/indicators/types";
import { benjaminiHochberg, binomialUpperP } from "@/lib/stats/multipleTesting";
import { betaBinomialShrink } from "@/lib/stats/shrinkage";
import { wilson } from "@/lib/stats/intervals";
import { kurtosis, mean, skewness, stdev } from "@/lib/stats/dsr";
import { costBpsPerSide } from "./costs";

export const THETA_IN = 0.6;
export const THETA_OUT = 0.52;
export const COST_GRID_BPS = [0, 1, 2, 5];

const BARS_PER_YEAR: Record<Timeframe, number> = {
  "1m": 252 * 390,
  "5m": 252 * 78,
  "15m": 252 * 26,
  "1h": 252 * 7,
  "4h": 252 * 2,
  "1d": 252,
};

export interface Trade {
  direction: "bullish" | "bearish";
  grossReturn: number;
  netReturn: number;
  hit: boolean;
}

export interface CellStats {
  symbol: string;
  timeframe: Timeframe;
  direction: "bullish" | "bearish";
  horizon: number;
  costBpsPerSide: number;
  n: number;
  hits: number;
  point: number | null;
  wilsonLo: number;
  wilsonHi: number;
  shrunk: number | null;
  pValue: number;
  significant: boolean;
  grossBps: number | null;
  netBps: number | null;
  medianNetBps: number | null;
  payoff: number | null;
  maxDrawdown: number | null;
  netSharpe: number | null;
  turnover: number;
  costSensitivity: { bps: number; netBps: number | null }[];
  netReturns: number[];
  label: string;
}

export function signedScore(call: BarCall): number {
  if (call.direction === "bullish") return call.probability / 100;
  if (call.direction === "bearish") return -call.probability / 100;
  return 0;
}

/**
 * Position path with a stricter entry than exit.
 * +1 long, -1 short, 0 flat. The position is the decision at that bar's close.
 */
export function hysteresisPath(scores: number[], thetaIn = THETA_IN, thetaOut = THETA_OUT): number[] {
  const path = new Array<number>(scores.length).fill(0);
  let position = 0;
  for (let index = 0; index < scores.length; index += 1) {
    const score = scores[index] ?? 0;
    if (position === 0) {
      if (score >= thetaIn) position = 1;
      else if (score <= -thetaIn) position = -1;
    } else if (position > 0 && score < thetaOut) {
      position = 0;
    } else if (position < 0 && score > -thetaOut) {
      position = 0;
    }
    path[index] = position;
  }
  return path;
}

function sampleTrades(bars: Bar[], scores: number[], horizon: number, costBps: number, direction: "bullish" | "bearish"): Trade[] {
  const path = hysteresisPath(scores);
  const want = direction === "bullish" ? 1 : -1;
  const trades: Trade[] = [];
  let index = 0;
  let armed = true;
  while (index < bars.length - horizon - 1) {
    const position = path[index];
    if (position !== want) {
      if (Math.abs(scores[index] ?? 0) < THETA_OUT) armed = true;
      index += 1;
      continue;
    }
    if (!armed) {
      index += 1;
      continue;
    }
    const entry = bars[index + 1]?.open;
    const exit = bars[index + 1 + horizon]?.open;
    if (!Number.isFinite(entry) || !Number.isFinite(exit) || !entry) {
      index += 1;
      continue;
    }
    const gross = (exit - entry) / entry;
    const calledGross = direction === "bullish" ? gross : -gross;
    const cost = (2 * costBps) / 10_000;
    const calledNet = calledGross - cost;
    trades.push({
      direction,
      grossReturn: calledGross,
      netReturn: calledNet,
      hit: calledNet > 0,
    });
    armed = false;
    index += horizon;
  }
  return trades;
}

function equityDrawdown(returns: number[]): number {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity *= 1 + value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak : 0);
  }
  return maxDrawdown;
}

function payoffRatio(returns: number[]): number | null {
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  if (wins.length === 0 || losses.length === 0) return null;
  const avgWin = mean(wins);
  const avgLoss = Math.abs(mean(losses));
  if (avgLoss === 0) return null;
  return avgWin / avgLoss;
}

export function evaluateDirection(input: {
  symbol: string;
  timeframe: Timeframe;
  direction: "bullish" | "bearish";
  bars: Bar[];
  calls: BarCall[];
  horizon: number;
  priorMean: number;
  priorStrength?: number;
}): CellStats {
  const scores = input.calls.map(signedScore);
  const cost = costBpsPerSide(input.symbol, input.bars);
  const trades = sampleTrades(input.bars, scores, input.horizon, cost, input.direction);
  const hits = trades.filter((trade) => trade.hit).length;
  const n = trades.length;
  const interval = wilson(hits, n);
  const shrunk = n === 0 ? null : betaBinomialShrink(hits, n, input.priorMean, input.priorStrength ?? 30);
  const net = trades.map((trade) => trade.netReturn);
  const gross = trades.map((trade) => trade.grossReturn);
  const sharpeStd = stdev(net);
  const netSharpe = n > 1 && sharpeStd > 0 ? (mean(net) / sharpeStd) * Math.sqrt(BARS_PER_YEAR[input.timeframe] / Math.max(1, input.horizon)) : null;
  const sensitivity = COST_GRID_BPS.map((bps) => {
    const alt = sampleTrades(input.bars, scores, input.horizon, bps, input.direction);
    return { bps, netBps: alt.length === 0 ? null : mean(alt.map((trade) => trade.netReturn)) * 10_000 };
  });
  const stats: CellStats = {
    symbol: input.symbol,
    timeframe: input.timeframe,
    direction: input.direction,
    horizon: input.horizon,
    costBpsPerSide: cost,
    n,
    hits,
    point: n === 0 ? null : hits / n,
    wilsonLo: interval.lo,
    wilsonHi: interval.hi,
    shrunk,
    pValue: binomialUpperP(hits, n, 0.5),
    significant: false,
    grossBps: n === 0 ? null : mean(gross) * 10_000,
    netBps: n === 0 ? null : mean(net) * 10_000,
    medianNetBps: n === 0 ? null : median(net) * 10_000,
    payoff: payoffRatio(net),
    maxDrawdown: n === 0 ? null : equityDrawdown(net),
    netSharpe,
    turnover: n,
    costSensitivity: sensitivity,
    netReturns: net,
    label: "",
  };
  stats.label = formatCell(stats);
  return stats;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatCell(stats: CellStats): string {
  if (stats.n === 0 || stats.point == null || stats.shrunk == null) {
    return `No completed ${stats.direction} trades on this timeframe after next-bar fills.`;
  }
  const gross = stats.grossBps == null ? "n/a" : `${stats.grossBps >= 0 ? "+" : ""}${stats.grossBps.toFixed(1)} bps`;
  const net = stats.netBps == null ? "n/a" : `${stats.netBps >= 0 ? "+" : ""}${stats.netBps.toFixed(1)} bps`;
  return `${pct(stats.point)} (95%: ${pct(stats.wilsonLo)}–${pct(stats.wilsonHi)}), n=${stats.n}, shrunk ${pct(stats.shrunk)}. Gross ${gross}, net ${net} over the next ${stats.horizon} bars.`;
}

export function applySignificance(cells: CellStats[], q = 0.1): CellStats[] {
  const flags = benjaminiHochberg(cells.map((cell) => cell.pValue), q);
  return cells.map((cell, index) => {
    const significant = cell.n > 0 && cell.wilsonLo > 0.5 && flags[index].reject;
    const next = { ...cell, significant };
    next.label = significant ? `${formatCell(next)} Significant at FDR ${q}.` : `${formatCell(next)} Not significant.`;
    return next;
  });
}

export function sharpeMoments(cells: CellStats[]): { sharpe: number; variance: number; skew: number; kurtosis: number; observations: number } {
  const series = cells.flatMap((cell) => cell.netReturns);
  const sharpes = cells.map((cell) => cell.netSharpe).filter((value): value is number => value != null);
  const sr = stdev(series) > 0 ? mean(series) / stdev(series) : 0;
  return {
    sharpe: sr,
    variance: sharpes.length > 1 ? stdev(sharpes) ** 2 : 0.01,
    skew: skewness(series),
    kurtosis: kurtosis(series),
    observations: series.length,
  };
}
