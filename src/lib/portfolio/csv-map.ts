export interface CsvMap {
  symbol: string;
  side: string;
  qty: string;
  price: string;
  date: string;
}

export const CSV_PRESETS: Record<string, CsvMap> = {
  generic: { symbol: "symbol", side: "side", qty: "quantity", price: "price", date: "date" },
  robinhood: { symbol: "Instrument", side: "Trans Code", qty: "Quantity", price: "Price", date: "Activity Date" },
  fidelity: { symbol: "Symbol", side: "Action", qty: "Quantity", price: "Price", date: "Run Date" },
  schwab: { symbol: "Symbol", side: "Action", qty: "Quantity", price: "Price", date: "Date" },
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((item) => item.trim()));
}

export function mapCsv(text: string, columns: CsvMap): { symbol: string; side: string; qty: number; price: number; date: string }[] {
  const table = parseCsv(text);
  if (!table.length) return [];
  const header = table[0].map((item) => item.trim());
  const index = (name: string) => header.findIndex((item) => item.toLowerCase() === name.toLowerCase());
  const symbol = index(columns.symbol);
  const side = index(columns.side);
  const qty = index(columns.qty);
  const price = index(columns.price);
  const date = index(columns.date);
  if ([symbol, side, qty, price].some((item) => item < 0)) return [];
  return table.slice(1).map((line) => ({
    symbol: (line[symbol] ?? "").trim().toUpperCase(),
    side: (line[side] ?? "").trim().toLowerCase(),
    qty: Math.abs(Number(String(line[qty] ?? "").replace(/[$,]/g, ""))),
    price: Number(String(line[price] ?? "").replace(/[$,]/g, "")),
    date: date >= 0 ? (line[date] ?? "").trim() : "",
  })).filter((row) => row.symbol && Number.isFinite(row.qty) && Number.isFinite(row.price));
}

export function sideToKind(side: string): "buy" | "sell" | "short" | "cover" | null {
  if (/(buy|bot)/.test(side)) return "buy";
  if (/(sell|sld)/.test(side) && !/short/.test(side)) return "sell";
  if (/short/.test(side) && !/cover/.test(side)) return "short";
  if (/cover/.test(side)) return "cover";
  return null;
}
