import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { parseQuery } from "@/lib/datasets/query";
import { PRESET_SCREENS, suggestFields } from "./fields";
import { csvEscape, joinRows, toCsv } from "./join";
import { technicalsFromBars } from "./technicals";

describe("screener", () => {
  it("joins missing fields as null and never as zero", () => {
    const rows = joinRows(
      [{ symbol: "AAA", mcap: 1, rsi14: null }],
      [{ AAA: { rsi14: 22, ivr: null } }, {}],
    );
    expect(rows[0].rsi14).toBe(22);
    expect(rows[0].ivr).toBeNull();
    expect(rows[0].ivr).not.toBe(0);
  });

  it("parses every preset and suggests only known fields", () => {
    for (const preset of PRESET_SCREENS) expect(() => parseQuery(preset.query)).not.toThrow();
    expect(suggestFields("rs")).toEqual(["rsi14"]);
    expect(suggestFields("nope")).toEqual([]);
  });

  it("escapes csv and computes technicals without filling gaps", () => {
    expect(csvEscape('Say "hi", now')).toBe('"Say ""hi"", now"');
    expect(toCsv([{ symbol: "A", name: "A, Inc" }], ["symbol", "name"])).toBe('symbol,name\nA,"A, Inc"');
    const bars: Bar[] = Array.from({ length: 30 }, (_, index) => ({
      time: index,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100 + index,
      volume: index === 29 ? 200 : 100,
    }));
    const stats = technicalsFromBars(bars);
    expect(stats.rsi14).not.toBeNull();
    expect(stats.sma200).toBeNull();
    expect(stats.ret5d).toBeGreaterThan(0);
    expect(stats.rvol20).toBeCloseTo(2, 5);
  });
});