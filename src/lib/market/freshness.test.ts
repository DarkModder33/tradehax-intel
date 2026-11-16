import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, isStale } from "./freshness";

describe("freshness thresholds", () => {
  const now = Date.parse("2026-11-16T15:00:00Z");
  it("uses a different window for live, intraday, daily, and weekly data", () => {
    expect(STALE_AFTER_MS.live).toBe(5 * 60_000);
    expect(STALE_AFTER_MS.intraday).toBe(45 * 60_000);
    expect(STALE_AFTER_MS.daily).toBe(30 * 60 * 60_000);
    expect(STALE_AFTER_MS.weekly).toBe(10 * 24 * 60 * 60_000);
    expect(isStale(now - 6 * 60_000, "live", now)).toBe(true);
    expect(isStale(now - 4 * 60_000, "live", now)).toBe(false);
    expect(isStale(now - 20 * 60 * 60_000, "daily", now)).toBe(false);
    expect(isStale(now - 31 * 60 * 60_000, "daily", now)).toBe(true);
  });
});
