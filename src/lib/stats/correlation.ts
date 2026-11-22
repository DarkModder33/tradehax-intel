function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pearson(left: number[], right: number[]): number | null {
  const n = Math.min(left.length, right.length);
  if (n < 3) return null;
  const a = left.slice(-n);
  const b = right.slice(-n);
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let index = 0; index < n; index += 1) {
    const xa = a[index] - ma;
    const xb = b[index] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

export function correlationMatrix(series: number[][]): number[][] {
  return series.map((row, i) => series.map((column, j) => {
    if (i === j) return 1;
    return pearson(row, column) ?? 0;
  }));
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    if (closes[index - 1] > 0 && closes[index] > 0) out.push(Math.log(closes[index] / closes[index - 1]));
  }
  return out;
}
