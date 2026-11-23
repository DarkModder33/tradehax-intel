import { describe, expect, it } from "vitest";
import { formatChange } from "@/lib/format";
import { quoteFromBars, withSessionChange } from "./worker-bars";

const day = (iso: string, close: number) => ({ time: Date.parse(iso), open: close, high: close, low: close, close, volume: 1 });

describe("day change", () => {
  it("formats percent units without scaling them again", () => {
    expect(formatChange(4.71)).toBe("+4.71%");
    expect(formatChange(-0.03)).toBe("-0.03%");
    expect(formatChange(null)).toBe("n/a");
  });

  it("re-bases a one-minute quote on the prior session's daily close", () => {
    const minute = [day("2026-11-23T20:58:00Z", 722.5), day("2026-11-23T20:59:00Z", 722.29)];
    const quote = quoteFromBars("SPY", minute);
    expect(quote.changePercent).toBeCloseTo(-0.029, 2);
    const daily = [day("2026-11-19T05:00:00Z", 715.87), day("2026-11-20T05:00:00Z", 689.81), day("2026-11-23T05:00:00Z", 722.29)];
    const fixed = withSessionChange(quote, daily);
    expect(fixed.previousClose).toBe(689.81);
    expect(fixed.changePercent).toBeCloseTo(4.71, 2);
  });

  it("uses the last earlier session when today's daily bar is missing", () => {
    const quote = quoteFromBars("SPY", [day("2026-11-23T15:00:00Z", 700), day("2026-11-23T15:01:00Z", 701)]);
    const fixed = withSessionChange(quote, [day("2026-11-19T05:00:00Z", 715.87), day("2026-11-20T05:00:00Z", 689.81)]);
    expect(fixed.previousClose).toBe(689.81);
  });

  it("leaves the quote alone without daily bars", () => {
    const quote = quoteFromBars("SPY", [day("2026-11-23T15:00:00Z", 700), day("2026-11-23T15:01:00Z", 701)]);
    expect(withSessionChange(quote, [])).toEqual(quote);
  });
});
