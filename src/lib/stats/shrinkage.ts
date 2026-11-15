/** Posterior mean of a beta-binomial hit rate. priorStrength is α+β. */
export function betaBinomialShrink(k: number, n: number, priorMean: number, priorStrength: number): number {
  const mean = Math.min(1, Math.max(0, priorMean));
  const strength = Math.max(0, priorStrength);
  const alpha = mean * strength;
  const beta = (1 - mean) * strength;
  return (k + alpha) / (n + alpha + beta);
}
