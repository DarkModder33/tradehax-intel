import type { Bar } from "@/lib/indicators/types";
import { ema } from "@/lib/indicators/ema";
import { rsi } from "@/lib/indicators/rsi";
import { sma } from "@/lib/indicators/sma";

export type CompareOp = ">" | "<" | "crosses above" | "crosses below";
export type Join = "AND" | "OR";

export interface SeriesRef {
  name: "close" | "sma" | "ema" | "rsi" | "high" | "low" | "change" | "dow";
  period?: number;
}

export interface Condition {
  left: SeriesRef;
  op: CompareOp;
  right: SeriesRef | number;
}

export interface Rule {
  join: Join;
  conditions: Condition[];
}

export interface StrategySpec {
  entry: Rule;
  exit: Rule;
  side: "long" | "short" | "both";
  sizePct: number;
  stopPct?: number;
  targetPct?: number;
  timeStop?: number;
}

export function seriesAt(bars: Bar[], index: number, ref: SeriesRef, cache: Map<string, Array<number | null>>): number | null {
  if (index < 0 || index >= bars.length) return null;
  const bar = bars[index];
  if (ref.name === "close") return bar.close;
  if (ref.name === "high") return bar.high;
  if (ref.name === "low") return bar.low;
  if (ref.name === "dow") return new Date(bar.time).getUTCDay();
  if (ref.name === "change") {
    if (index === 0 || bars[index - 1].close === 0) return null;
    return bar.close / bars[index - 1].close - 1;
  }
  const period = ref.period ?? 14;
  const key = `${ref.name}:${period}`;
  let values = cache.get(key);
  if (!values) {
    const closes = bars.map((item) => item.close);
    if (ref.name === "sma") values = sma(closes, period);
    else if (ref.name === "ema") values = ema(closes, period);
    else values = rsi(closes, period);
    cache.set(key, values);
  }
  return values[index];
}

export function conditionTrue(bars: Bar[], index: number, condition: Condition, cache: Map<string, Array<number | null>>): boolean {
  const left = seriesAt(bars, index, condition.left, cache);
  const right = typeof condition.right === "number" ? condition.right : seriesAt(bars, index, condition.right, cache);
  const prevLeft = seriesAt(bars, index - 1, condition.left, cache);
  const prevRight = typeof condition.right === "number" ? condition.right : seriesAt(bars, index - 1, condition.right, cache);
  if (left == null || right == null) return false;
  if (condition.op === ">") return left > right;
  if (condition.op === "<") return left < right;
  if (prevLeft == null || prevRight == null) return false;
  if (condition.op === "crosses above") return prevLeft <= prevRight && left > right;
  return prevLeft >= prevRight && left < right;
}

export function ruleTrue(bars: Bar[], index: number, rule: Rule, cache: Map<string, Array<number | null>>): boolean {
  if (!rule.conditions.length) return false;
  const flags = rule.conditions.map((condition) => conditionTrue(bars, index, condition, cache));
  return rule.join === "OR" ? flags.some(Boolean) : flags.every(Boolean);
}

export function encodeStrategy(spec: StrategySpec): string {
  const json = JSON.stringify(spec);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeStrategy(raw: string): StrategySpec | null {
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))) as StrategySpec;
  } catch {
    return null;
  }
}

export function smaCross(fast = 50, slow = 200): StrategySpec {
  return {
    side: "long",
    sizePct: 1,
    entry: { join: "AND", conditions: [{ left: { name: "sma", period: fast }, op: "crosses above", right: { name: "sma", period: slow } }] },
    exit: { join: "AND", conditions: [{ left: { name: "sma", period: fast }, op: "crosses below", right: { name: "sma", period: slow } }] },
  };
}
