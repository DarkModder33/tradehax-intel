export interface NavDay {
  date: string;
  nav: number;
  shares: number;
  flow: number | null;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function parseNavDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function sharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const block of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    strings.push([...block[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((part) => part[1]).join(""));
  }
  return strings;
}

function cellValue(attrs: string, raw: string | undefined, strings: string[]): string | null {
  if (raw == null) return null;
  if (attrs.includes('t="s"')) return strings[Number(raw)] ?? null;
  return raw;
}

/** SPDR navhist sheet: one header row, then newest day first. Flow is the change in shares times that day's NAV. */
export function parseNavHistory(sharedXml: string, sheetXml: string): NavDay[] {
  const strings = sharedStrings(sharedXml);
  const days: { date: string; nav: number; shares: number }[] = [];
  for (const row of sheetXml.matchAll(/<row r="\d+"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map<string, string>();
    for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
      const value = cellValue(cell[2], cell[3], strings);
      if (value != null) cells.set(cell[1], value);
    }
    const date = cells.get("A");
    const nav = Number(cells.get("B"));
    const shares = Number(cells.get("C"));
    const parsed = date ? parseNavDate(date) : null;
    if (!parsed || !Number.isFinite(nav) || !Number.isFinite(shares)) continue;
    days.push({ date: parsed, nav, shares });
  }
  return days.map((day, index) => {
    const older = days[index + 1];
    return { ...day, flow: older ? (day.shares - older.shares) * day.nav : null };
  });
}
