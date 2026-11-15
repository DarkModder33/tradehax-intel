export interface FtdRow {
  date: string;
  symbol: string;
  quantity: number;
  description: string;
  price: number | null;
}

export function parseFtd(text: string): FtdRow[] {
  const rows: FtdRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.toLowerCase().startsWith("settlement")) continue;
    const [date, , symbol, quantity, description, price] = line.split("|");
    if (!symbol || !/^\d{8}$/.test(date ?? "")) continue;
    rows.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      symbol: symbol.trim().toUpperCase(),
      quantity: Number(quantity) || 0,
      description: (description ?? "").trim(),
      price: price && Number.isFinite(Number(price)) ? Number(price) : null,
    });
  }
  return rows;
}
