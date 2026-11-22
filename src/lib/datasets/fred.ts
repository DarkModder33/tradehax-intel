export interface FredPoint {
  date: string;
  value: number | null;
}

const TENORS = ["DGS3MO", "DGS2", "DGS5", "DGS10", "DGS30"] as const;

export function parseFredCsv(text: string): FredPoint[] {
  const lines = text.trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const [date, raw] = line.split(",");
    const cleaned = (raw ?? "").trim();
    const value = cleaned === "." || cleaned === "" ? null : Number(cleaned);
    return { date: (date ?? "").trim(), value: value != null && Number.isFinite(value) ? value : null };
  }).filter((point) => point.date);
}

export function assembleCurve(latest: Record<string, number | null>): { tenor: string; value: number | null }[] {
  return TENORS.map((tenor) => ({ tenor, value: latest[tenor] ?? null }));
}

export function appendPc(previous: { date: string; total: number | null }[], next: { date: string; total: number | null }[]): { date: string; total: number | null }[] {
  const map = new Map(previous.map((row) => [row.date, row]));
  for (const row of next) map.set(row.date, row);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
