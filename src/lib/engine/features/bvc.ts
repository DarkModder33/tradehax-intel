import type { Bar } from "@/lib/indicators/types";
import { normalCdf } from "@/lib/stats/normal";

/** Bulk-volume classification buy fraction for one bar. */
export function buyFraction(change: number, sigma: number): number {
  if (!Number.isFinite(sigma) || sigma <= 0) return change > 0 ? 1 : change < 0 ? 0 : 0.5;
  return normalCdf(change / sigma);
}

/** Signed volume imbalance over the last `window` bars, in [-1, 1]. */
export function bvcImbalance(bars: Bar[], index: number, window = 5, sigmaWindow = 20): number {
  const start = Math.max(1, index - window + 1);
  let signed = 0;
  let volume = 0;
  const sigma = changeSigma(bars, index, sigmaWindow);
  for (let cursor = start; cursor <= index; cursor += 1) {
    const change = bars[cursor].close - bars[cursor - 1].close;
    const fraction = buyFraction(change, sigma);
    signed += (2 * fraction - 1) * bars[cursor].volume;
    volume += bars[cursor].volume;
  }
  if (volume <= 0) return 0;
  return signed / volume;
}

function changeSigma(bars: Bar[], index: number, window: number): number {
  const start = Math.max(1, index - window + 1);
  const changes: number[] = [];
  for (let cursor = start; cursor <= index; cursor += 1) changes.push(bars[cursor].close - bars[cursor - 1].close);
  if (changes.length < 2) return 0;
  const avg = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const variance = changes.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (changes.length - 1);
  return Math.sqrt(variance);
}
