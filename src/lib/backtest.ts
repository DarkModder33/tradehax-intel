import { replayDirections } from "@/lib/indicators/factors";
import { MIN_BARS } from "@/lib/indicators/build-signal";
import type { Bar, Direction, Timeframe } from "@/lib/indicators/types";

/** How many completed bars ahead a call is judged. Shown in the history line. */
export const FORWARD_BARS: Record<Timeframe, number> = {
  "1m": 5,
  "5m": 6,
  "15m": 4,
  "1h": 4,
  "4h": 3,
  "1d": 5,
};

export const MIN_HISTORY_SAMPLE = 8;

export interface CallOutcome {
  direction: "bullish" | "bearish";
  /** Price change from the signal bar to the bar N steps ahead. */
  rawReturn: number;
  /** Positive when price moved the way the call said. */
  calledReturn: number;
  hit: boolean;
}

export interface DirectionStats {
  direction: "bullish" | "bearish" | "all";
  sampleSize: number;
  hits: number;
  /** Null when there is nothing to measure. */
  hitRate: number | null;
  /** Mean called return. Null when the sample is empty. */
  averageCalledReturn: number | null;
}

export interface ReplayReport {
  timeframe: Timeframe;
  horizon: number;
  bullish: DirectionStats;
  bearish: DirectionStats;
  all: DirectionStats;
}

export function scoreOutcome(
  entry: number,
  exit: number,
  direction: "bullish" | "bearish",
): CallOutcome | null {
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry === 0) return null;
  const rawReturn = (exit - entry) / entry;
  const calledReturn = direction === "bullish" ? rawReturn : -rawReturn;
  return {
    direction,
    rawReturn,
    calledReturn,
    hit: calledReturn > 0,
  };
}

export function summarizeOutcomes(
  outcomes: CallOutcome[],
  direction: DirectionStats["direction"],
): DirectionStats {
  const slice = direction === "all" ? outcomes : outcomes.filter((item) => item.direction === direction);
  if (slice.length === 0) {
    return { direction, sampleSize: 0, hits: 0, hitRate: null, averageCalledReturn: null };
  }
  const hits = slice.filter((item) => item.hit).length;
  const averageCalledReturn = slice.reduce((sum, item) => sum + item.calledReturn, 0) / slice.length;
  return {
    direction,
    sampleSize: slice.length,
    hits,
    hitRate: hits / slice.length,
    averageCalledReturn,
  };
}

/** Walk every bar that has a full warmup and a full forward window. */
export function replaySignals(symbol: string, timeframe: Timeframe, bars: Bar[]): ReplayReport {
  void symbol;
  const horizon = FORWARD_BARS[timeframe];
  const directions = replayDirections(bars, timeframe);
  const outcomes: CallOutcome[] = [];
  const lastIndex = bars.length - 1 - horizon;
  for (let index = MIN_BARS - 1; index <= lastIndex; index += 1) {
    const direction = directions[index];
    if (direction !== "bullish" && direction !== "bearish") continue;
    const outcome = scoreOutcome(bars[index].close, bars[index + horizon].close, direction);
    if (outcome) outcomes.push(outcome);
  }
  return {
    timeframe,
    horizon,
    bullish: summarizeOutcomes(outcomes, "bullish"),
    bearish: summarizeOutcomes(outcomes, "bearish"),
    all: summarizeOutcomes(outcomes, "all"),
  };
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function signedPercent(fraction: number): string {
  const value = fraction * 100;
  const text = `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  return text;
}

export function historyLabel(report: ReplayReport | undefined, direction: Direction): string {
  if (!report) return "History has not been measured for this timeframe yet.";
  if (direction === "neutral") {
    return "Mixed readings are left out of the hit rate.";
  }
  const stats = direction === "bullish" ? report.bullish : report.bearish;
  const barWord = report.horizon === 1 ? "bar" : "bars";
  if (stats.sampleSize === 0 || stats.hitRate == null || stats.averageCalledReturn == null) {
    return `No completed ${direction} signals on this timeframe yet.`;
  }
  if (stats.sampleSize < MIN_HISTORY_SAMPLE) {
    return `Only ${stats.sampleSize} past ${direction} signals on this timeframe, too few to quote a hit rate.`;
  }
  return `Historically right ${percent(stats.hitRate)} of the time over ${stats.sampleSize} ${direction} signals. Average move in the called direction was ${signedPercent(stats.averageCalledReturn)} over the next ${report.horizon} ${barWord}.`;
}
