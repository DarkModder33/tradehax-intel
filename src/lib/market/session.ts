export type SessionStatus = "open" | "closed";

export interface UsEquitySession {
  status: SessionStatus;
  label: string;
}

/**
 * Regular US equity hours, 9:30am to 4:00pm America/New_York, weekdays.
 * This is a clock check for the badge, not a holiday calendar.
 */
export function usEquitySession(now: Date): UsEquitySession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";
  const open = !weekend && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  return {
    status: open ? "open" : "closed",
    label: open ? "US market open" : "US market closed",
  };
}
