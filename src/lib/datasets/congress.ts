export interface HouseFiling {
  name: string;
  state: string;
  filingType: string;
  filed: string;
  docId: string;
}

export interface PtrTrade {
  owner: string;
  ticker: string;
  kind: string;
  amount: string;
}

/** Tab-separated House clerk index. FilingType P is a periodic transaction report. */
export function parseHouseIndex(text: string): HouseFiling[] {
  const rows: HouseFiling[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("Prefix")) continue;
    const parts = line.split("\t");
    if (parts.length < 9) continue;
    const [prefix, last, first, suffix, filingType, state, , filed, docId] = parts;
    if (!docId || !/^\d+$/.test(docId.trim())) continue;
    const name = [prefix, first, last, suffix].map((part) => part.trim()).filter(Boolean).join(" ");
    rows.push({ name, state: state.trim(), filingType: filingType.trim(), filed: filed.trim(), docId: docId.trim() });
  }
  return rows;
}

/** A pdftotext -layout line that contains a ticker in parentheses. */
export function parsePtrLine(line: string): PtrTrade | null {
  const match = line.match(/\(([A-Z]{1,5})\)\s+([PS]|S\(partial\))\b(.*)$/);
  if (!match) return null;
  const amount = match[3].match(/\$[\d,]+\s*-\s*\$[\d,]+/)?.[0] ?? "amount not listed";
  return { owner: line.slice(0, line.indexOf("(")).trim() || "filer", ticker: match[1], kind: match[2], amount };
}
