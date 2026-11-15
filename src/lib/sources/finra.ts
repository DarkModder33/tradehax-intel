export interface ShortVolumeRow {
  date: string;
  symbol: string;
  shortVolume: number;
  shortExemptVolume: number;
  totalVolume: number;
  market: string;
}

export function finraShortVolumeUrl(yyyymmdd: string): string {
  return `https://cdn.finra.org/equity/regsho/daily/CNMSshvol${yyyymmdd}.txt`;
}

/** FINRA Reg SHO daily file. Pipe-delimited, with a header row. */
export function parseFinraShortVolume(text: string): ShortVolumeRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: ShortVolumeRow[] = [];
  for (const line of lines) {
    if (line.toLowerCase().startsWith("date|")) continue;
    const [date, symbol, shortVolume, shortExemptVolume, totalVolume, market] = line.split("|");
    if (!symbol || !/^\d{8}$/.test(date ?? "")) continue;
    const total = Number(totalVolume);
    if (!Number.isFinite(total)) continue;
    rows.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      symbol: symbol.trim().toUpperCase(),
      shortVolume: Number(shortVolume) || 0,
      shortExemptVolume: Number(shortExemptVolume) || 0,
      totalVolume: total,
      market: (market ?? "").trim(),
    });
  }
  return rows;
}

export function shortVolumeRatio(row: ShortVolumeRow): number | null {
  if (row.totalVolume <= 0) return null;
  return row.shortVolume / row.totalVolume;
}
