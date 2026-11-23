export interface CongressRow {
  ticker: string;
  asset: string;
  type: string;
  owner: string;
  transactionDate: string;
  amount: string;
  amountLow: number | null;
  amountHigh: number | null;
  member: string;
  party: string | null;
  district: string;
  filed: string;
  url: string;
}

export function partyLetter(party: string | null | undefined): string {
  if (!party) return "?";
  if (/^dem/i.test(party)) return "D";
  if (/^rep/i.test(party)) return "R";
  return party.slice(0, 1).toUpperCase();
}

export function isBuy(type: string): boolean {
  return type === "Purchase";
}

/** Midpoint of the disclosed band; open-ended bands use the floor. */
export function amountMid(row: Pick<CongressRow, "amountLow" | "amountHigh">): number {
  if (row.amountLow == null) return 0;
  return row.amountHigh == null ? row.amountLow : (row.amountLow + row.amountHigh) / 2;
}

/** Tickers ranked by members trading them since `since` (YYYY-MM-DD). */
export function topTickers(rows: CongressRow[], since: string, limit = 8) {
  const map = new Map<string, { ticker: string; buys: number; sells: number; members: Set<string>; volume: number }>();
  for (const row of rows) {
    if (row.transactionDate < since) continue;
    const entry = map.get(row.ticker) ?? { ticker: row.ticker, buys: 0, sells: 0, members: new Set<string>(), volume: 0 };
    if (isBuy(row.type)) entry.buys += 1;
    else entry.sells += 1;
    entry.members.add(row.member);
    entry.volume += amountMid(row);
    map.set(row.ticker, entry);
  }
  return [...map.values()]
    .sort((a, b) => b.members.size - a.members.size || b.buys + b.sells - (a.buys + a.sells) || b.volume - a.volume)
    .slice(0, limit)
    .map((entry) => ({ ticker: entry.ticker, buys: entry.buys, sells: entry.sells, members: entry.members.size, volume: entry.volume }));
}
