export interface InfoTableRow {
  name: string;
  cusip: string;
  value: number;
  shares: number;
}

export function parseInfoTable(xml: string): InfoTableRow[] {
  const rows: InfoTableRow[] = [];
  const blocks = xml.split(/<infoTable>/i).slice(1);
  for (const block of blocks) {
    const name = block.match(/<nameOfIssuer>([^<]+)/i)?.[1]?.trim() ?? "";
    const cusip = block.match(/<cusip>([^<]+)/i)?.[1]?.trim() ?? "";
    const value = Number(block.match(/<value>([^<]+)/i)?.[1] ?? "");
    const shares = Number(block.match(/<sshPrnamt>([^<]+)/i)?.[1] ?? "");
    if (!name || !cusip || !Number.isFinite(value)) continue;
    rows.push({ name, cusip, value, shares: Number.isFinite(shares) ? shares : 0 });
  }
  return rows;
}

export function quarterChange(previous: { cusip: string; value: number }[], current: { cusip: string; value: number }[]): { cusip: string; previous: number; current: number; change: number }[] {
  const prior = new Map(previous.map((row) => [row.cusip, row.value]));
  return current.map((row) => ({
    cusip: row.cusip,
    previous: prior.get(row.cusip) ?? 0,
    current: row.value,
    change: row.value - (prior.get(row.cusip) ?? 0),
  }));
}
