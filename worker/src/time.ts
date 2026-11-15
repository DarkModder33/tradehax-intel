/** US equity session helpers in America/New_York. Exchange holidays are not modeled; a holiday just returns no trades. */
const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

export function etParts(date: Date) {
  const map = Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: map.weekday as string,
  };
}

/** UTC instant for an ET wall-clock time on the given ET date. */
export function etToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const p = etParts(new Date(guess));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(guess + (guess - asUtc));
}

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60 + 15;

export function inSession(date: Date): boolean {
  const p = etParts(date);
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  const minutes = p.hour * 60 + p.minute;
  return minutes >= OPEN_MIN && minutes <= CLOSE_MIN;
}

/** End of the most recent session (16:15 ET) at or before the date. */
export function lastSessionEnd(date: Date): Date {
  for (let back = 0; back < 7; back++) {
    const day = new Date(date.getTime() - back * 86_400_000);
    const p = etParts(day);
    if (p.weekday === "Sat" || p.weekday === "Sun") continue;
    const end = etToUtc(p.year, p.month, p.day, 16, 15);
    if (end.getTime() <= date.getTime()) return end;
  }
  return date;
}
