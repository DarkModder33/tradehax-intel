import type { Trade } from "./simulate";

export interface BacktestMetrics {
  totalReturn: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  maxDrawdownBars: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  exposure: number;
  trades: number;
  buyHold: number;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: number[], downside = false): number {
  if (values.length < 2) return 0;
  const base = downside ? values.map((value) => Math.min(0, value)) : values;
  const avg = downside ? 0 : mean(values);
  const variance = base.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

export function metricsOf(equity: number[], trades: Trade[], bars: number, years: number, buyHold: number): BacktestMetrics {
  const returns: number[] = [];
  for (let index = 1; index < equity.length; index += 1) {
    if (equity[index - 1] > 0) returns.push(equity[index] / equity[index - 1] - 1);
  }
  const total = equity.length ? equity[equity.length - 1] / equity[0] - 1 : 0;
  const vol = stdev(returns) * Math.sqrt(252);
  const sharpe = vol === 0 ? 0 : (mean(returns) * 252) / vol;
  const down = stdev(returns, true) * Math.sqrt(252);
  const sortino = down === 0 ? 0 : (mean(returns) * 252) / down;
  let peak = equity[0] ?? 1;
  let maxDd = 0;
  let ddStart = 0;
  let maxDdBars = 0;
  for (let index = 0; index < equity.length; index += 1) {
    if (equity[index] >= peak) {
      peak = equity[index];
      ddStart = index;
    }
    const dd = peak > 0 ? equity[index] / peak - 1 : 0;
    if (dd < maxDd) {
      maxDd = dd;
      maxDdBars = index - ddStart;
    }
  }
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const held = trades.reduce((sum, trade) => sum + (trade.exitIndex - trade.entryIndex), 0);
  const cagr = years > 0 ? (1 + total) ** (1 / years) - 1 : total;
  return {
    totalReturn: total,
    cagr,
    volatility: vol,
    sharpe,
    sortino,
    calmar: maxDd === 0 ? 0 : cagr / Math.abs(maxDd),
    maxDrawdown: maxDd,
    maxDrawdownBars: maxDdBars,
    winRate: trades.length ? wins.length / trades.length : 0,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -grossLoss / losses.length : 0,
    exposure: bars > 0 ? held / bars : 0,
    trades: trades.length,
    buyHold,
  };
}
