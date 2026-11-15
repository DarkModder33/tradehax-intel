import { ema } from "./ema";

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

/** MACD line (fast EMA − slow EMA), signal EMA, and histogram. Defaults are 12, 26, 9. */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line: Array<number | null> = closes.map((_, index) => {
    const fastValue = fastEma[index];
    const slowValue = slowEma[index];
    if (fastValue == null || slowValue == null) return null;
    return fastValue - slowValue;
  });

  const points: MacdPoint[] = line.map((value) => ({
    macd: value,
    signal: null,
    histogram: null,
  }));

  const first = line.findIndex((value) => value != null);
  if (first === -1) return points;

  const defined = line.slice(first).map((value) => value as number);
  const signal = ema(defined, signalPeriod);
  for (let index = 0; index < defined.length; index += 1) {
    const signalValue = signal[index];
    const point = points[first + index];
    point.signal = signalValue;
    if (signalValue != null && point.macd != null) {
      point.histogram = point.macd - signalValue;
    }
  }
  return points;
}
