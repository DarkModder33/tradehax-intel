import { normalCdf, normalQuantile } from "./normal";

const EULER = 0.5772156649015329;

export interface DeflatedSharpeInput {
  /** Per-period Sharpe (mean / std), not annualized. */
  sharpe: number;
  /** Number of configurations tried. */
  trials: number;
  /** Variance of Sharpe ratios across those trials. */
  sharpeVariance: number;
  skew: number;
  kurtosis: number;
  /** Number of return observations. */
  observations: number;
}

/**
 * Deflated Sharpe Ratio from Bailey & López de Prado.
 * Returns a probability in [0, 1], not a paper's reported return.
 */
export function deflatedSharpe(input: DeflatedSharpeInput): number {
  const n = Math.max(2, Math.floor(input.trials));
  const variance = Math.max(input.sharpeVariance, 1e-8);
  const z1 = normalQuantile(1 - 1 / n);
  const z2 = normalQuantile(1 - 1 / (n * Math.E));
  const sr0 = Math.sqrt(variance) * ((1 - EULER) * z1 + EULER * z2);
  const sr = input.sharpe;
  const t = Math.max(2, input.observations);
  const denom = Math.sqrt(Math.max(1e-8, 1 - input.skew * sr + ((input.kurtosis - 1) / 4) * sr * sr));
  const stat = ((sr - sr0) * Math.sqrt(t - 1)) / denom;
  return normalCdf(stat);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function skewness(values: number[]): number {
  if (values.length < 3) return 0;
  const avg = mean(values);
  const s = stdev(values);
  if (s === 0) return 0;
  const m3 = values.reduce((sum, value) => sum + (value - avg) ** 3, 0) / values.length;
  return m3 / s ** 3;
}

export function kurtosis(values: number[]): number {
  if (values.length < 4) return 3;
  const avg = mean(values);
  const s = stdev(values);
  if (s === 0) return 3;
  const m4 = values.reduce((sum, value) => sum + (value - avg) ** 4, 0) / values.length;
  return m4 / s ** 4;
}
