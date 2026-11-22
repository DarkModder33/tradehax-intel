export interface EarningsMove {
  sym: string;
  reportDate: string;
  timing: "bmo" | "amc";
  implied: number | null;
  realized: number | null;
  spot: number | null;
  beat: "beat" | "miss" | "unknown";
}

/** BMO uses the report-day close versus the prior close. AMC uses the next close versus the report-day close. */
export function realizedFromCloses(timing: "bmo" | "amc", previous: number, reportDay: number, nextDay: number | null): number | null {
  if (timing === "bmo") {
    if (!(previous > 0) || !(reportDay > 0)) return null;
    return Math.abs(reportDay / previous - 1);
  }
  if (nextDay == null || !(reportDay > 0) || !(nextDay > 0)) return null;
  return Math.abs(nextDay / reportDay - 1);
}

export function moveRatio(implied: number | null, realized: number | null): number | null {
  if (implied == null || realized == null || !(implied > 0)) return null;
  return realized / implied;
}

export function appendEarningsMoves(previous: EarningsMove[], next: EarningsMove[]): EarningsMove[] {
  const key = (row: EarningsMove) => `${row.sym}|${row.reportDate}`;
  const map = new Map<string, EarningsMove>();
  for (const row of previous) map.set(key(row), row);
  for (const row of next) {
    const prior = map.get(key(row));
    map.set(key(row), prior ? { ...prior, ...row, implied: row.implied ?? prior.implied, realized: row.realized ?? prior.realized } : row);
  }
  return [...map.values()].sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.sym.localeCompare(b.sym));
}
