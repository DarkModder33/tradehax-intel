import { TIMEFRAME_LABEL, TIMEFRAMES, type Direction, type Signal, type Timeframe } from "./types";

const SHORT_TERM = new Set<Timeframe>(["1m", "5m", "15m"]);
const HIGHER_TERM = new Set<Timeframe>(["1h", "4h", "1d"]);

export interface Agreement {
  direction: Direction | "split";
  bullish: number;
  bearish: number;
  neutral: number;
  total: number;
  /** Count of timeframes on the leading side. Zero when the board is split or empty. */
  aligned: number;
  label: string;
  narrative: string;
}

export function listNames(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function labels(signals: Signal[]): string[] {
  return signals.map((signal) => TIMEFRAME_LABEL[signal.timeframe]);
}

function leanClause(signals: Signal[], direction: "bullish" | "bearish"): string {
  const verb = signals.length === 1 ? "leans" : "lean";
  return `${listNames(labels(signals))} ${verb} ${direction}`;
}

function sidePhrase(signals: Signal[], direction: "bullish" | "bearish"): string {
  const listed = listNames(labels(signals));
  if (signals.length === 1) return `The ${listed} timeframe leans ${direction}`;
  return `The ${listed} timeframes lean ${direction}`;
}

function sameSide(signals: Signal[], direction: Direction): boolean {
  return signals.length >= 2 && signals.every((signal) => signal.direction === direction);
}

/**
 * Say where the timeframes agree. Short-term is 1m, 5m, and 15m.
 * Higher-term is 1h, 4h, and 1D.
 */
export function describeAgreement(signals: Signal[]): Agreement {
  const ordered = TIMEFRAMES.map((timeframe) =>
    signals.find((signal) => signal.timeframe === timeframe),
  ).filter((signal): signal is Signal => Boolean(signal));

  const bullish = ordered.filter((signal) => signal.direction === "bullish");
  const bearish = ordered.filter((signal) => signal.direction === "bearish");
  const neutral = ordered.filter((signal) => signal.direction === "neutral");
  const total = ordered.length;

  const base = {
    bullish: bullish.length,
    bearish: bearish.length,
    neutral: neutral.length,
    total,
  };

  if (total === 0) {
    return {
      ...base,
      direction: "neutral",
      aligned: 0,
      label: "No lean",
      narrative: "No timeframe has a clear lean.",
    };
  }

  const short = ordered.filter(
    (signal) => SHORT_TERM.has(signal.timeframe) && signal.direction !== "neutral",
  );
  const higher = ordered.filter(
    (signal) => HIGHER_TERM.has(signal.timeframe) && signal.direction !== "neutral",
  );

  if (sameSide(higher, "bullish") && sameSide(short, "bearish")) {
    return {
      ...base,
      direction: "split",
      aligned: 0,
      label: "Trends conflict",
      narrative: `${sidePhrase(higher, "bullish")}, while ${leanClause(short, "bearish")}. The short-term tape is fighting the larger trend.`,
    };
  }
  if (sameSide(higher, "bearish") && sameSide(short, "bullish")) {
    return {
      ...base,
      direction: "split",
      aligned: 0,
      label: "Trends conflict",
      narrative: `${sidePhrase(higher, "bearish")}, while ${leanClause(short, "bullish")}. The short-term tape is fighting the larger trend.`,
    };
  }

  if (bullish.length === total) {
    return {
      ...base,
      direction: "bullish",
      aligned: bullish.length,
      label: `${bullish.length} of ${total} lean bullish`,
      narrative: `All ${total} timeframes lean bullish.`,
    };
  }
  if (bearish.length === total) {
    return {
      ...base,
      direction: "bearish",
      aligned: bearish.length,
      label: `${bearish.length} of ${total} lean bearish`,
      narrative: `All ${total} timeframes lean bearish.`,
    };
  }
  if (bullish.length === 0 && bearish.length === 0) {
    return {
      ...base,
      direction: "neutral",
      aligned: 0,
      label: "No lean",
      narrative: "No timeframe has a clear lean.",
    };
  }
  if (bullish.length === bearish.length) {
    return {
      ...base,
      direction: "split",
      aligned: 0,
      label: "Split",
      narrative: `Timeframes are split, ${bullish.length} bullish and ${bearish.length} bearish, so there is no confluence.`,
    };
  }

  const leading = bullish.length > bearish.length ? "bullish" : "bearish";
  const leaders = leading === "bullish" ? bullish : bearish;
  const opposition = leading === "bullish" ? bearish : bullish;
  const opposite = leading === "bullish" ? "bearish" : "bullish";
  const parts = [`${leaders.length} of ${total} timeframes lean ${leading}.`];
  if (opposition.length > 0) parts.push(`${leanClause(opposition, opposite)}.`);
  if (neutral.length > 0) {
    const verb = neutral.length === 1 ? "is" : "are";
    parts.push(`${listNames(labels(neutral))} ${verb} mixed.`);
  }

  return {
    ...base,
    direction: leading,
    aligned: leaders.length,
    label: `${leaders.length} of ${total} lean ${leading}`,
    narrative: parts.join(" "),
  };
}

export function rankSignals<T extends { probability: number; symbol: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => b.probability - a.probability || a.symbol.localeCompare(b.symbol),
  );
}
