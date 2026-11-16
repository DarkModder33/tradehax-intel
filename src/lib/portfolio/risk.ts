function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    if (closes[index - 1] > 0 && closes[index] > 0) out.push(Math.log(closes[index] / closes[index - 1]));
  }
  return out;
}

/** OLS beta of asset returns on market returns. */
export function beta(asset: number[], market: number[]): number | null {
  const n = Math.min(asset.length, market.length);
  if (n < 5) return null;
  const y = asset.slice(-n);
  const x = market.slice(-n);
  const mx = mean(x);
  const my = mean(y);
  let varX = 0;
  let cov = 0;
  for (let index = 0; index < n; index += 1) {
    varX += (x[index] - mx) ** 2;
    cov += (x[index] - mx) * (y[index] - my);
  }
  if (varX === 0) return null;
  return cov / varX;
}

export function annualizedVol(returns: number[]): number | null {
  if (returns.length < 2) return null;
  const avg = mean(returns);
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252);
}

export function maxDrawdown(equity: number[]): number | null {
  if (!equity.length) return null;
  let peak = equity[0];
  let worst = 0;
  for (const value of equity) {
    peak = Math.max(peak, value);
    if (peak > 0) worst = Math.min(worst, value / peak - 1);
  }
  return worst;
}
