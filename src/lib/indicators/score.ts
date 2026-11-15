import { clamp } from "./math";
import type { Direction, Factor, FactorId } from "./types";

/**
 * Fixed shares of the model. These are the numbers the dashboard legend prints.
 * Changing them changes every confidence score.
 */
export const FACTOR_WEIGHTS: Record<FactorId, number> = {
  ema: 0.22,
  macd: 0.22,
  rsi: 0.18,
  vwap: 0.18,
  volume: 0.2,
};

/** Confidence = strength × this + agreement × the rest, then scaled by coverage. */
export const SCORE_BLEND = { strength: 0.7, agreement: 0.3 } as const;

/** Absolute weighted vote below this is called mixed rather than a direction. */
export const NEUTRAL_NET = 0.12;

export interface ScoreResult {
  direction: Direction;
  probability: number;
  net: number;
  agreement: number;
  summary: string;
}

const LEADING_ACRONYM = /^(RSI|MACD|VWAP|EMA)\b/;

function joinSentences(first: string, second: string): string {
  const body = LEADING_ACRONYM.test(second)
    ? second
    : second.charAt(0).toLowerCase() + second.slice(1);
  return `${first.replace(/\.$/, "")}, and ${body}`;
}

function strongest(factors: Factor[], direction: Direction): Factor | null {
  const matching = factors
    .filter((factor) => factor.direction === direction)
    .sort((a, b) => {
      const diff = Math.abs(b.score) * b.weight - Math.abs(a.score) * a.weight;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  return matching[0] ?? null;
}

/** Plain-English reason, drawn from the factors that actually voted for the call. */
export function explain(direction: Direction, factors: Factor[]): string {
  if (direction === "neutral") {
    const bullish = strongest(factors, "bullish");
    const bearish = strongest(factors, "bearish");
    if (bullish && bearish) {
      return `No clear lean. ${bullish.label} is bullish while ${bearish.label} is bearish, and they cancel out.`;
    }
    return "The indicators sit near the middle, so this timeframe has no clear lean.";
  }

  const ranked = factors
    .filter((factor) => factor.direction === direction)
    .sort((a, b) => {
      const diff = Math.abs(b.score) * b.weight - Math.abs(a.score) * a.weight;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  if (ranked.length === 0) {
    return "The weighted vote has a lean, but no single factor is strong enough to quote.";
  }
  if (ranked.length === 1) return ranked[0].detail;
  return joinSentences(ranked[0].detail, ranked[1].detail);
}

/**
 * Turn factor votes into a direction and a 0–100 confidence score.
 *
 * `net` is the weighted average of the votes. Confidence is mostly that
 * strength, plus how many of the factors that took a side agree. It is then
 * scaled down when some factors stayed neutral, so one loud indicator cannot
 * score like a full agreement.
 */
export function scoreFactors(factors: Factor[]): ScoreResult {
  const weightSum = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const weighted = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  const net = weightSum === 0 ? 0 : weighted / weightSum;
  const directional = factors.filter((factor) => factor.direction !== "neutral");
  const sign = net >= NEUTRAL_NET ? 1 : net <= -NEUTRAL_NET ? -1 : 0;
  const direction: Direction = sign > 0 ? "bullish" : sign < 0 ? "bearish" : "neutral";
  const agreeing = directional.filter(
    (factor) =>
      (sign > 0 && factor.direction === "bullish") ||
      (sign < 0 && factor.direction === "bearish"),
  );
  const agreement = directional.length === 0 ? 0 : agreeing.length / directional.length;
  const coverage = factors.length === 0 ? 0 : directional.length / factors.length;

  const probability =
    sign === 0
      ? Math.round(clamp(Math.abs(net) / NEUTRAL_NET, 0, 1) * 15)
      : Math.round(
          clamp(
            (Math.abs(net) * SCORE_BLEND.strength + agreement * SCORE_BLEND.agreement) *
              (0.7 + 0.3 * coverage),
            0,
            1,
          ) * 100,
        );

  return {
    direction,
    probability,
    net,
    agreement,
    summary: explain(direction, factors),
  };
}
