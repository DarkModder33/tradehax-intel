import type { Bar } from "@/lib/indicators/types";

/** Fold bars into fixed buckets. The bucket timestamp is the floor of the open time. */
export function aggregateBars(bars: Bar[], bucketMs: number): Bar[] {
  if (bucketMs <= 0) throw new Error("bucketMs must be positive");
  const buckets = new Map<number, Bar>();
  for (const bar of bars) {
    const time = Math.floor(bar.time / bucketMs) * bucketMs;
    const existing = buckets.get(time);
    if (!existing) {
      buckets.set(time, { ...bar, time });
      continue;
    }
    existing.high = Math.max(existing.high, bar.high);
    existing.low = Math.min(existing.low, bar.low);
    existing.close = bar.close;
    existing.volume += bar.volume;
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}
