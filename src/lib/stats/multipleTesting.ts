export interface BhResult {
  pValue: number;
  reject: boolean;
}

/**
 * Benjamini–Hochberg at false-discovery rate `q`.
 * `pValues[i]` is paired with the returned flag.
 */
export function benjaminiHochberg(pValues: number[], q = 0.1): BhResult[] {
  const indexed = pValues.map((pValue, index) => ({ pValue: clampP(pValue), index }));
  indexed.sort((a, b) => a.pValue - b.pValue);
  const m = indexed.length;
  let cutoff = -1;
  for (let i = 0; i < m; i += 1) {
    const rank = i + 1;
    if (indexed[i].pValue <= (rank / m) * q) cutoff = i;
  }
  const flags = new Array<BhResult>(m);
  indexed.forEach((item, order) => {
    flags[item.index] = { pValue: item.pValue, reject: cutoff >= 0 && order <= cutoff };
  });
  return flags;
}

function clampP(p: number): number {
  if (!Number.isFinite(p)) return 1;
  return Math.min(1, Math.max(0, p));
}

/** One-sided binomial p-value P(X >= k) under Binomial(n, p0). */
export function binomialUpperP(k: number, n: number, p0 = 0.5): number {
  if (n <= 0) return 1;
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p0 <= 0) return k > 0 ? 0 : 1;
  if (p0 >= 1) return 1;
  const logs: number[] = [];
  for (let hits = k; hits <= n; hits += 1) logs.push(logBinomialPmf(n, hits, p0));
  const max = Math.max(...logs);
  const sum = logs.reduce((total, value) => total + Math.exp(value - max), 0);
  return Math.min(1, Math.exp(max) * sum);
}

function logBinomialPmf(n: number, k: number, p: number): number {
  return logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

function logChoose(n: number, k: number): number {
  const kk = Math.min(k, n - k);
  let sum = 0;
  for (let i = 1; i <= kk; i += 1) sum += Math.log(n - kk + i) - Math.log(i);
  return sum;
}
