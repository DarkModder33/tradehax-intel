/** Decision dates from the Federal Reserve FOMC calendar page, read 2026-11-16. */
export const FOMC_MEETINGS: { ends: string; note?: string }[] = [
  { ends: "2026-01-28" },
  { ends: "2026-03-18", note: "projections" },
  { ends: "2026-04-29" },
  { ends: "2026-06-17", note: "projections" },
  { ends: "2026-07-29" },
  { ends: "2026-09-16", note: "projections" },
  { ends: "2026-10-28" },
  { ends: "2026-12-09", note: "projections" },
  { ends: "2027-01-27" },
  { ends: "2027-03-17" },
  { ends: "2027-04-28" },
  { ends: "2027-06-09" },
  { ends: "2027-07-28" },
  { ends: "2027-09-15" },
  { ends: "2027-10-27", note: "strategy meeting" },
  { ends: "2027-11-17" },
];

export function upcomingFomc(today: string): { ends: string; note?: string }[] {
  return FOMC_MEETINGS.filter((meeting) => meeting.ends >= today);
}
