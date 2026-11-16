export type ScreenerRow = Record<string, string | number | null>;

function clean(value: unknown): string | number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value;
  return null;
}

/** Later sources fill holes. A missing field stays null, never zero. */
export function joinRows(base: ScreenerRow[], extras: Array<Record<string, Partial<ScreenerRow>>>): ScreenerRow[] {
  return base.map((row) => {
    const symbol = String(row.symbol ?? "");
    const next: ScreenerRow = { ...row };
    for (const book of extras) {
      const extra = book[symbol];
      if (!extra) continue;
      for (const [key, value] of Object.entries(extra)) {
        if (key === "symbol") continue;
        if (next[key] == null) next[key] = clean(value);
      }
    }
    for (const [key, value] of Object.entries(next)) next[key] = clean(value);
    return next;
  });
}

export function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: ScreenerRow[], columns: string[]): string {
  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  return lines.join("\n");
}
