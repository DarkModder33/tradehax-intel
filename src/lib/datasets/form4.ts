export interface InsiderTrade {
  owner: string;
  ticker: string | null;
  code: string;
  shares: number;
  price: number | null;
  acquired: boolean;
  form: string;
}

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}[^>]*>\\s*(?:<value>)?([^<]+)`, "i"));
  return match ? match[1].trim() : null;
}

/** Pull the first non-derivative transaction out of a Form 4 XML document. */
export interface ClusterBuy {
  ticker: string;
  owners: string[];
  count: number;
}

/** Three or more distinct open-market buyers (code P) inside 10 days. */
export function clusterBuys(trades: { owner: string; ticker: string | null; code: string; date: string }[]): ClusterBuy[] {
  const groups = new Map<string, { owner: string; date: string }[]>();
  for (const trade of trades) {
    if (trade.code.toUpperCase() !== "P" || !trade.ticker) continue;
    const bucket = groups.get(trade.ticker) ?? [];
    bucket.push({ owner: trade.owner, date: trade.date });
    groups.set(trade.ticker, bucket);
  }
  const clusters: ClusterBuy[] = [];
  for (const [ticker, rows] of groups) {
    const ordered = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
    for (let index = 0; index < ordered.length; index += 1) {
      const start = Date.parse(ordered[index].date);
      const window = ordered.filter((row) => {
        const time = Date.parse(row.date);
        return time >= start && time - start <= 10 * 86_400_000;
      });
      const owners = [...new Set(window.map((row) => row.owner))];
      if (owners.length >= 3) {
        clusters.push({ ticker, owners, count: owners.length });
        break;
      }
    }
  }
  return clusters;
}

export function parseForm4(xml: string): InsiderTrade | null {
  const owner = tag(xml, "rptOwnerName");
  const ticker = tag(xml, "issuerTradingSymbol");
  const code = tag(xml, "transactionCode");
  const shares = Number(tag(xml, "transactionShares"));
  const priceRaw = tag(xml, "transactionPricePerShare");
  const side = tag(xml, "transactionAcquiredDisposedCode");
  if (!owner || !code || !Number.isFinite(shares)) return null;
  return {
    owner,
    ticker: ticker ? ticker.toUpperCase() : null,
    code: code.toUpperCase(),
    shares,
    price: priceRaw && Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : null,
    acquired: side?.toUpperCase() !== "D",
    form: "4",
  };
}
