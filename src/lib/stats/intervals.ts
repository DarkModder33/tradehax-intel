export interface WilsonInterval {
  /** Point estimate k/n. */
  p: number;
  lo: number;
  hi: number;
}

/** Wilson score interval. z defaults to the two-sided 95% normal quantile. */
export function wilson(k: number, n: number, z = 1.96): WilsonInterval {
  if (n <= 0) return { p: 0, lo: 0, hi: 1 };
  const phat = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / denom;
  return {
    p: phat,
    lo: Math.max(0, center - margin),
    hi: Math.min(1, center + margin),
  };
}

/** Regularized incomplete beta I_x(a, b) via a continued fraction. */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;
  // Use the symmetry to keep the fraction stable.
  if (x < (a + 1) / (a + b + 2)) return front * betaContinuedFraction(x, a, b);
  return 1 - (Math.exp(b * Math.log(1 - x) + a * Math.log(x) - lnBeta) / b) * betaContinuedFraction(1 - x, b, a);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIter = 200;
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return h;
}

function logGamma(z: number): number {
  const p = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905,
    -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < p.length; i += 1) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Quantile of the Beta(a, b) distribution. */
export function betaQuantile(probability: number, a: number, b: number): number {
  if (probability <= 0) return 0;
  if (probability >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let step = 0; step < 60; step += 1) {
    const mid = (lo + hi) / 2;
    if (regularizedIncompleteBeta(mid, a, b) < probability) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Jeffreys equal-tailed interval, Beta(k+1/2, n-k+1/2). */
export function jeffreysInterval(k: number, n: number): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const a = k + 0.5;
  const b = n - k + 0.5;
  return { lo: betaQuantile(0.025, a, b), hi: betaQuantile(0.975, a, b) };
}
