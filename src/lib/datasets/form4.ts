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
