import type { Bar } from "@/lib/indicators/types";

const ETFS = new Set(["SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLP", "XLU", "XLB", "XLC", "XLRE"]);

/** Half the Corwin–Schultz high-low spread, in basis points, floored by a symbol minimum. */
export function costBpsPerSide(symbol: string, bars: Bar[], userMinBps?: number): number {
  const floor = userMinBps ?? (ETFS.has(symbol) ? 1 : 5);
  const estimated = corwinSchultzBps(bars);
  return Math.max(floor, estimated / 2);
}

/** Corwin–Schultz spread estimate in basis points. Returns 0 when highs and lows are unusable. */
export function corwinSchultzBps(bars: Bar[]): number {
  const betas: number[] = [];
  const gammas: number[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    if (previous.high <= 0 || previous.low <= 0 || current.high <= 0 || current.low <= 0) continue;
    if (previous.high <= previous.low || current.high <= current.low) continue;
    const beta = Math.log(previous.high / previous.low) ** 2 + Math.log(current.high / current.low) ** 2;
    const high = Math.max(previous.high, current.high);
    const low = Math.min(previous.low, current.low);
    if (low <= 0 || high <= low) continue;
    betas.push(beta);
    gammas.push(Math.log(high / low) ** 2);
  }
  if (betas.length < 5) return 0;
  const beta = betas.reduce((sum, value) => sum + value, 0) / betas.length;
  const gamma = gammas.reduce((sum, value) => sum + value, 0) / gammas.length;
  const root = Math.sqrt(8);
  const den = 3 - 2 * Math.SQRT2;
  const alpha = (Math.sqrt(2 * beta) - Math.sqrt(beta)) / den - Math.sqrt(Math.max(0, gamma) / den);
  // The published estimator uses sqrt(2β) − sqrt(β) over (3−2√2). Negative alpha means the spread is not identified.
  void root;
  if (!Number.isFinite(alpha) || alpha <= 0) return 0;
  const spread = (2 * (Math.exp(alpha) - 1)) / (1 + Math.exp(alpha));
  if (!Number.isFinite(spread) || spread <= 0) return 0;
  return spread * 10_000;
}
