export interface OiPoint {
  symbol: string;
  previous: number;
  current: number;
  change: number;
}

export function oiChanges(previous: { symbol: string; openInterest: number }[], current: { symbol: string; openInterest: number }[]): OiPoint[] {
  const prior = new Map(previous.map((row) => [row.symbol, row.openInterest]));
  return current
    .map((row) => {
      const before = prior.get(row.symbol);
      if (before == null) return null;
      return { symbol: row.symbol, previous: before, current: row.openInterest, change: row.openInterest - before };
    })
    .filter((row): row is OiPoint => row != null && row.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}
