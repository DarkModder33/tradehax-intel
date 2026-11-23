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

export interface CongressTrade {
  ticker: string;
  asset: string;
  assetType: string;
  type: "Purchase" | "Sale" | "Partial sale" | "Exchange";
  owner: string;
  transactionDate: string;
  notifiedDate: string;
  amount: string;
  amountLow: number | null;
  amountHigh: number | null;
}

const TX_LINE = /(?:^|\s)(P|S \(partial\)|S|E)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;
const TYPE_NAME: Record<string, CongressTrade["type"]> = { P: "Purchase", S: "Sale", "S (partial)": "Partial sale", E: "Exchange" };
const OWNER = /^\s*(SP|JT|DC)\s{2,}/;
const STOP = /^\s*(F\s+S\s*:|S\s+O\s*:|D\s+:|C\s*:|ID\s+Owner|\* For the complete|I\s+V\s+D)/;

function isoFromUs(value: string): string {
  const [month, day, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

/** "$1,001 - $15,000" to bounds. "Over $50,000,000" keeps a low bound only. */
export function amountBounds(amount: string): { low: number | null; high: number | null } {
  const numbers = [...amount.matchAll(/\$([\d,]+)/g)].map((match) => Number(match[1].replace(/,/g, "")));
  if (numbers.length === 0) return { low: null, high: null };
  if (/over/i.test(amount)) return { low: numbers[0], high: null };
  return { low: numbers[0], high: numbers[1] ?? null };
}

/**
 * Transaction rows from `pdftotext -layout` output of an electronically filed House PTR.
 * Scanned paper filings have no text layer and return no rows. Rows without a ticker
 * (Treasury bills, private funds) are dropped.
 */
export function parsePtrText(text: string): CongressTrade[] {
  const lines = text.split(/\r?\n/);
  const trades: CongressTrade[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(TX_LINE);
    if (!match || match.index == null) continue;
    const head = line.slice(0, match.index);
    const owner = head.match(OWNER)?.[1] ?? "Self";
    const assetLines = [head.replace(OWNER, "")];
    let amount = match[4].replace(/\s{2,}.*$/, "").trim();
    for (let next = index + 1; next < Math.min(lines.length, index + 4); next += 1) {
      const follow = lines[next];
      if (!follow.trim() || STOP.test(follow) || TX_LINE.test(follow)) break;
      // The amount column wraps ("$15,001 -" then "$50,000"); the asset column wraps on the left.
      const tail = follow.match(/\s{3,}(\$[\d,]+)\s*$/);
      if (amount.endsWith("-") && tail) {
        amount = `${amount} ${tail[1]}`;
        assetLines.push(follow.slice(0, tail.index));
      } else {
        assetLines.push(follow);
      }
    }
    const asset = assetLines.join(" ").replace(/\s+/g, " ").trim();
    const code = asset.match(/\(([A-Z][A-Z0-9.]{0,6})\)\s*\[([A-Z]{2})\]/);
    if (!code) continue;
    const bounds = amountBounds(amount);
    trades.push({
      ticker: code[1],
      asset: asset.replace(/\s*\[[A-Z]{2}\]\s*$/, ""),
      assetType: code[2],
      type: TYPE_NAME[match[1]],
      owner,
      transactionDate: isoFromUs(match[2]),
      notifiedDate: isoFromUs(match[3]),
      amount: amount.replace(/\s*-\s*/, " - "),
      amountLow: bounds.low,
      amountHigh: bounds.high,
    });
  }
  return trades;
}

/** "CA31" to { state: "CA", district: 31 }. At-large seats are "AK00". */
export function splitDistrict(code: string): { state: string; district: number | null } {
  const match = code.trim().match(/^([A-Z]{2})(\d{1,2})$/);
  if (!match) return { state: code.trim().slice(0, 2), district: null };
  return { state: match[1], district: Number(match[2]) };
}

/** Party by state and district from unitedstates/congress-legislators current terms. */
export function houseParties(legislators: Array<{ terms?: Array<{ type?: string; state?: string; district?: number; party?: string }> }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const person of legislators) {
    const term = person.terms?.at(-1);
    if (!term || term.type !== "rep" || !term.state || term.district == null || !term.party) continue;
    map.set(`${term.state}${term.district}`, term.party);
  }
  return map;
}
