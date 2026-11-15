import type { Bar } from "@/lib/indicators/types";

/** EWMA of squared log returns. Half-life is in bars. */
export function ewmaVolatility(bars: Bar[], halfLife = 20): number[] {
  const lambda = Math.exp(-Math.LN2 / halfLife);
  const out = new Array<number>(bars.length).fill(0);
  let variance = 0;
  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1].close;
    const close = bars[index].close;
    const logReturn = previous > 0 && close > 0 ? Math.log(close / previous) : 0;
    variance = lambda * variance + (1 - lambda) * logReturn * logReturn;
    out[index] = Math.sqrt(variance);
  }
  return out;
}

export function atr(bars: Bar[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;
  let sum = 0;
  for (let index = 0; index < bars.length; index += 1) {
    const previousClose = index === 0 ? bars[0].close : bars[index - 1].close;
    const range = Math.max(
      bars[index].high - bars[index].low,
      Math.abs(bars[index].high - previousClose),
      Math.abs(bars[index].low - previousClose),
    );
    if (index < period) {
      sum += range;
      if (index === period - 1) out[index] = sum / period;
      continue;
    }
    const prior = out[index - 1] ?? range;
    out[index] = (prior * (period - 1) + range) / period;
  }
  return out;
}

/** Suggested fraction of a normal position. P_edge is in [0, 1]. */
export function conviction(edge: number, realizedVol: number, targetVol: number): number {
  if (!Number.isFinite(realizedVol) || realizedVol <= 0 || !Number.isFinite(targetVol) || targetVol <= 0) return 0;
  const sized = edge * (targetVol / realizedVol);
  return Math.min(1, Math.max(0, sized));
}

export function targetVolatility(vols: number[]): number {
  const usable = vols.filter((value) => value > 0);
  if (usable.length === 0) return 0;
  const sorted = [...usable].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
