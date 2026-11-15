import { describe, expect, it } from "vitest";
import { aggregateBars } from "./resample";

describe("aggregateBars", () => {
  it("folds opens, highs, lows, closes, and volume into a bucket", () => {
    const hour = 60 * 60 * 1000;
    const bars = aggregateBars(
      [
        { time: 0, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
        { time: hour, open: 1.5, high: 3, low: 1.4, close: 2.5, volume: 5 },
        { time: 4 * hour, open: 2.5, high: 2.6, low: 2, close: 2.2, volume: 7 },
      ],
      4 * hour,
    );
    expect(bars).toEqual([
      { time: 0, open: 1, high: 3, low: 0.5, close: 2.5, volume: 15 },
      { time: 4 * hour, open: 2.5, high: 2.6, low: 2, close: 2.2, volume: 7 },
    ]);
  });
});
