import type { Bar } from "@/lib/indicators/types";

function etParts(time: number): { hour: number; minute: number; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
    day: `${pick("year")}-${pick("month")}-${pick("day")}`,
  };
}

export function minuteOfDay(time: number): number {
  const clock = etParts(time);
  return clock.hour * 60 + clock.minute;
}

export interface IntradayMomentum {
  firstHalfHour: number | null;
  midday: number | null;
  side: "bullish" | "bearish" | "neutral";
  detail: string;
}

/**
 * First-half-hour return from the session's first bar through 10:00 ET.
 * This is a feature, not a published return.
 */
export function intradayMomentum(bars: Bar[]): IntradayMomentum {
  if (bars.length < 3) {
    return { firstHalfHour: null, midday: null, side: "neutral", detail: "Intraday momentum needs a session of bars." };
  }
  const lastDay = etParts(bars[bars.length - 1].time).day;
  const session = bars.filter((bar) => etParts(bar.time).day === lastDay);
  const open = session[0];
  const ten = session.find((bar) => minuteOfDay(bar.time) >= 10 * 60);
  const fifteen = session.find((bar) => minuteOfDay(bar.time) >= 15 * 60);
  const fifteenThirty = session.find((bar) => minuteOfDay(bar.time) >= 15 * 60 + 30);
  if (!open || !ten || open.open === 0) {
    return { firstHalfHour: null, midday: null, side: "neutral", detail: "Intraday momentum: this session does not reach 10:00 ET." };
  }
  const first = ten.close / open.open - 1;
  const midday = fifteen && fifteenThirty && fifteen.open !== 0 ? fifteenThirty.close / fifteen.open - 1 : null;
  const score = Math.sign(first) + (midday == null ? 0 : Math.sign(midday));
  const side = score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral";
  return {
    firstHalfHour: first,
    midday,
    side,
    detail: `First-half-hour return is ${(first * 100).toFixed(2)}%. ${midday == null ? "The 15:00–15:30 return is not in these bars." : `15:00–15:30 return is ${(midday * 100).toFixed(2)}%.`}`,
  };
}

export interface OpeningRange {
  direction: "bullish" | "bearish" | "neutral";
  relativeVolume: number | null;
  sessions: number;
  detail: string;
}

export function openingRange(bars: Bar[]): OpeningRange {
  const byDay = new Map<string, Bar[]>();
  for (const bar of bars) {
    const day = etParts(bar.time).day;
    const list = byDay.get(day) ?? [];
    list.push(bar);
    byDay.set(day, list);
  }
  const days = [...byDay.keys()];
  const last = days.at(-1);
  if (!last) return { direction: "neutral", relativeVolume: null, sessions: 0, detail: "Opening range needs intraday bars." };
  const today = byDay.get(last) ?? [];
  const first = today.filter((bar) => minuteOfDay(bar.time) < 9 * 60 + 35);
  if (first.length === 0) {
    return { direction: "neutral", relativeVolume: null, sessions: days.length, detail: "Opening range: no bars in the first 5 minutes." };
  }
  const up = first[first.length - 1].close >= first[0].open;
  const volume = first.reduce((sum, bar) => sum + bar.volume, 0);
  const prior = days.slice(0, -1).map((day) => {
    const rows = (byDay.get(day) ?? []).filter((bar) => minuteOfDay(bar.time) < 9 * 60 + 35);
    return rows.reduce((sum, bar) => sum + bar.volume, 0);
  }).filter((value) => value > 0);
  const average = prior.length === 0 ? null : prior.reduce((sum, value) => sum + value, 0) / prior.length;
  const relative = average && average > 0 ? volume / average : null;
  const active = relative != null && relative >= 1;
  return {
    direction: active ? (up ? "bullish" : "bearish") : "neutral",
    relativeVolume: relative,
    sessions: prior.length,
    detail: relative == null
      ? `Opening range has ${prior.length} prior sessions, not enough to judge relative volume.`
      : `First 5 minutes are ${up ? "up" : "down"} with relative volume ${relative.toFixed(2)} versus ${prior.length} sessions${prior.length < 14 ? " (14 is the published window)" : ""}.`,
  };
}

export interface NoiseBand {
  distance: number | null;
  sessions: number;
  detail: string;
}

export function noiseArea(bars: Bar[]): NoiseBand {
  const byDay = new Map<string, Bar[]>();
  for (const bar of bars) {
    const day = etParts(bar.time).day;
    const list = byDay.get(day) ?? [];
    list.push(bar);
    byDay.set(day, list);
  }
  const days = [...byDay.keys()];
  if (days.length < 2) return { distance: null, sessions: days.length, detail: "Noise band needs more than one session." };
  const moves = new Map<number, number[]>();
  for (const day of days.slice(0, -1)) {
    const rows = byDay.get(day) ?? [];
    const open = rows[0]?.open;
    if (!open) continue;
    for (const bar of rows) {
      const slot = minuteOfDay(bar.time);
      const list = moves.get(slot) ?? [];
      list.push(Math.abs(bar.close / open - 1));
      moves.set(slot, list);
    }
  }
  const today = byDay.get(days[days.length - 1]) ?? [];
  const last = today.at(-1);
  const open = today[0]?.open;
  const prevClose = days.length > 1 ? byDay.get(days[days.length - 2])?.at(-1)?.close : undefined;
  if (!last || !open) return { distance: null, sessions: days.length - 1, detail: "Noise band: today's open is missing." };
  const slotMoves = moves.get(minuteOfDay(last.time)) ?? [];
  if (slotMoves.length === 0) {
    return { distance: null, sessions: days.length - 1, detail: "Noise band: no history for this minute of day." };
  }
  const sigma = slotMoves.reduce((sum, value) => sum + value, 0) / slotMoves.length;
  const upper = Math.max(open, prevClose ?? open) * (1 + sigma);
  const lower = Math.min(open, prevClose ?? open) * (1 - sigma);
  const outside = last.close > upper ? (last.close - upper) / last.close : last.close < lower ? (last.close - lower) / last.close : 0;
  return {
    distance: outside,
    sessions: slotMoves.length,
    detail: `Noise band uses ${slotMoves.length} sessions at this minute. Price is ${(outside * 100).toFixed(2)}% outside the band.`,
  };
}

/** Mean return of this minute-of-day over earlier sessions. */
export function sameSlotReturn(bars: Bar[], index: number): number | null {
  const slot = minuteOfDay(bars[index].time);
  const day = etParts(bars[index].time).day;
  const samples: number[] = [];
  let currentDay = "";
  for (let cursor = 1; cursor < index; cursor += 1) {
    const stamp = etParts(bars[cursor].time);
    if (stamp.day === day || stamp.hour * 60 + stamp.minute !== slot) continue;
    if (stamp.day === currentDay) continue;
    currentDay = stamp.day;
    if (bars[cursor - 1].close === 0) continue;
    samples.push(bars[cursor].close / bars[cursor - 1].close - 1);
  }
  const recent = samples.slice(-20);
  if (recent.length < 3) return null;
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}
