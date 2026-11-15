import { ema } from "./ema";
import { macd } from "./macd";
import { clamp, isFiniteNumber } from "./math";
import { rsi } from "./rsi";
import { FACTOR_LABEL, type Bar, type Factor, type FactorId, type Timeframe } from "./types";
import { sessionKey, sessionVwap, trailingVwap } from "./vwap";
import { volumeRatio } from "./volume";
import { FACTOR_WEIGHTS } from "./score";

/** A factor only takes a side once its vote is at least this strong. */
export const VOTE_THRESHOLD = 0.15;

function formatRatio(value: number): string {
  return `${value.toFixed(1)}×`;
}

function formatDistance(fraction: number): string {
  const percent = Math.abs(fraction * 100);
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`;
}

function formatRsi(value: number): string {
  return value.toFixed(1);
}

function vote(id: FactorId, score: number, detail: string): Factor {
  const clamped = clamp(isFiniteNumber(score) ? score : 0, -1, 1);
  const direction =
    clamped >= VOTE_THRESHOLD ? "bullish" : clamped <= -VOTE_THRESHOLD ? "bearish" : "neutral";
  return {
    id,
    label: FACTOR_LABEL[id],
    direction,
    score: clamped,
    weight: FACTOR_WEIGHTS[id],
    detail,
  };
}

function emaFactor(closes: number[]): Factor {
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  const fastNow = fast[fast.length - 1];
  const slowNow = slow[slow.length - 1];
  const fastPrev = fast[fast.length - 2];
  const slowPrev = slow[slow.length - 2];
  const close = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2];

  if (
    !isFiniteNumber(fastNow) ||
    !isFiniteNumber(slowNow) ||
    !isFiniteNumber(fastPrev) ||
    !isFiniteNumber(slowPrev) ||
    !isFiniteNumber(close) ||
    close === 0 ||
    !isFiniteNumber(previousClose) ||
    previousClose === 0
  ) {
    return vote("ema", 0, "There is not enough history yet for the 9 and 21 EMAs.");
  }

  const spread = (fastNow - slowNow) / close;
  const previousSpread = (fastPrev - slowPrev) / previousClose;
  const crossedUp = fastPrev <= slowPrev && fastNow > slowNow;
  const crossedDown = fastPrev >= slowPrev && fastNow < slowNow;

  if (crossedUp) {
    return vote("ema", 0.95, "The 9-period EMA just crossed above the 21, a short-term trend flip upward.");
  }
  if (crossedDown) {
    return vote("ema", -0.95, "The 9-period EMA just crossed below the 21, a short-term trend flip downward.");
  }

  const widening = Math.abs(spread) > Math.abs(previousSpread);
  const magnitude = widening ? clamp(Math.abs(spread) / 0.004, 0.4, 0.9) : 0.32;
  if (fastNow > slowNow) {
    return vote(
      "ema",
      magnitude,
      widening
        ? "The 9-period EMA is above the 21 and the gap is widening, so the short-term trend is up."
        : "The 9-period EMA is still above the 21, but the gap is narrowing.",
    );
  }
  if (fastNow < slowNow) {
    return vote(
      "ema",
      -magnitude,
      widening
        ? "The 9-period EMA is below the 21 and the gap is widening, so the short-term trend is down."
        : "The 9-period EMA is still below the 21, but the gap is narrowing.",
    );
  }
  return vote("ema", 0, "The 9-period and 21-period EMAs are on top of each other, so trend is not leaning.");
}

function macdFactor(closes: number[]): Factor {
  const points = macd(closes);
  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  const close = closes[closes.length - 1] ?? 0;
  const hist = last?.histogram;
  const prevHist = previous?.histogram;

  if (!isFiniteNumber(hist) || !isFiniteNumber(prevHist)) {
    return vote("macd", 0, "MACD is still warming up, so it did not vote.");
  }

  if (prevHist <= 0 && hist > 0) {
    return vote("macd", 0.85, "MACD crossed above its signal line on this bar.");
  }
  if (prevHist >= 0 && hist < 0) {
    return vote("macd", -0.85, "MACD crossed below its signal line on this bar.");
  }

  const flatBand = Math.max(Math.abs(close) * 0.00005, 1e-8);
  if (Math.abs(hist) < flatBand) {
    return vote("macd", 0, "MACD histogram is flat, so momentum is not leaning.");
  }

  const expanding = Math.abs(hist) > Math.abs(prevHist);
  const magnitude = clamp(
    Math.abs(hist) / Math.max(Math.abs(close) * 0.002, 1e-8),
    expanding ? 0.45 : 0.25,
    expanding ? 1 : 0.55,
  );
  if (hist > 0) {
    return vote(
      "macd",
      magnitude,
      expanding
        ? "MACD histogram is positive and expanding, so upside momentum is building."
        : "MACD is still positive, but the histogram is shrinking.",
    );
  }
  return vote(
    "macd",
    -magnitude,
    expanding
      ? "MACD histogram is negative and expanding, so downside momentum is building."
      : "MACD is still negative, but the histogram is shrinking.",
  );
}

function rsiFactor(closes: number[]): Factor {
  const series = rsi(closes, 14);
  const value = series[series.length - 1];
  const earlier = series[series.length - 4] ?? series[series.length - 2];
  if (!isFiniteNumber(value)) {
    return vote("rsi", 0, "RSI is still warming up, so it did not vote.");
  }

  const slope = isFiniteNumber(earlier) ? value - earlier : 0;
  if (value < 30) {
    const magnitude = clamp(0.45 + (30 - value) / 40, 0.45, 1);
    return vote(
      "rsi",
      magnitude,
      `RSI is ${formatRsi(value)}, an oversold reading that often means the selloff is stretched.`,
    );
  }
  if (value > 70) {
    const magnitude = clamp(0.45 + (value - 70) / 40, 0.45, 1);
    return vote(
      "rsi",
      -magnitude,
      `RSI is ${formatRsi(value)}, an overbought reading that means the rally looks stretched.`,
    );
  }
  if (value >= 55 && slope > 1) {
    return vote(
      "rsi",
      clamp(Math.abs(value - 50) / 25, 0.25, 0.7),
      `RSI is ${formatRsi(value)} and rising, so momentum is pointing up.`,
    );
  }
  if (value <= 45 && slope < -1) {
    return vote(
      "rsi",
      -clamp(Math.abs(value - 50) / 25, 0.25, 0.7),
      `RSI is ${formatRsi(value)} and falling, so momentum is pointing down.`,
    );
  }
  return vote("rsi", 0, `RSI is ${formatRsi(value)}, near the middle, so momentum is not leaning.`);
}

function vwapFactor(bars: Bar[], timeframe: Timeframe): Factor {
  const close = bars[bars.length - 1]?.close;
  if (!isFiniteNumber(close) || close === 0) {
    return vote("vwap", 0, "VWAP could not be computed for this window.");
  }

  const intraday = timeframe !== "1d";
  const anchor = intraday
    ? sessionVwap(bars, sessionKey(bars[bars.length - 1].time))
    : trailingVwap(bars, 20);
  if (!isFiniteNumber(anchor) || anchor === 0) {
    return vote("vwap", 0, "VWAP could not be computed for this window.");
  }

  const distance = (close - anchor) / anchor;
  const fullMove = intraday ? 0.004 : 0.015;
  const score = clamp(distance / fullMove, -1, 1);
  const where = formatDistance(distance);

  if (Math.abs(score) < VOTE_THRESHOLD) {
    return vote("vwap", score, "Price is sitting on VWAP, so this factor is neutral.");
  }
  if (intraday) {
    return vote(
      "vwap",
      score,
      distance > 0
        ? `Price is ${where} above session VWAP, on the strong side of today's volume.`
        : `Price is ${where} below session VWAP, on the weak side of today's volume.`,
    );
  }
  return vote(
    "vwap",
    score,
    distance > 0
      ? `Price is ${where} above the 20-session VWAP.`
      : `Price is ${where} below the 20-session VWAP.`,
  );
}

function volumeFactor(bars: Bar[]): Factor {
  const ratio = volumeRatio(bars.map((bar) => bar.volume), 20);
  if (!isFiniteNumber(ratio)) {
    return vote("volume", 0, "Volume wasn't available, so it did not vote.");
  }
  if (ratio < 0.75) {
    return vote(
      "volume",
      0,
      `Volume is quiet at ${formatRatio(ratio)} the recent average, so this bar has little backing.`,
    );
  }

  const last = bars[bars.length - 1];
  const up = last.close > last.open * 1.0001;
  const down = last.close < last.open * 0.9999;
  if (ratio < 1.15 || (!up && !down)) {
    return vote(
      "volume",
      0,
      `Volume is about average at ${formatRatio(ratio)}, so it adds little confirmation.`,
    );
  }

  const magnitude = clamp((ratio - 1) / 1.2, 0.2, 1);
  if (up) {
    return vote(
      "volume",
      magnitude,
      `Volume is ${formatRatio(ratio)} the recent average on an up bar, which confirms the push.`,
    );
  }
  return vote(
    "volume",
    -magnitude,
    `Volume is ${formatRatio(ratio)} the recent average on a down bar, which confirms the selling.`,
  );
}

/** Build the five factor votes for the latest bar. Always returns them in a stable order. */
export function buildFactors(bars: Bar[], timeframe: Timeframe): Factor[] {
  const closes = bars.map((bar) => bar.close);
  return [
    emaFactor(closes),
    macdFactor(closes),
    rsiFactor(closes),
    vwapFactor(bars, timeframe),
    volumeFactor(bars),
  ];
}
