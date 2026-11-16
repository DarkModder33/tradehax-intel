import { describe, expect, it } from "vitest";
import type { FlowPrint } from "@/lib/flow/classify";
import { matchesRule, newHits, type AlertRule } from "./rules";

const print: FlowPrint = {
  time: "2026-11-13T15:00:00.000Z",
  contract: "NVDA1",
  root: "NVDA",
  expiry: "2026-11-20",
  strike: 200,
  right: "call",
  side: "ASK",
  size: 20,
  price: 2,
  premium: 40_000,
  delta: 0.3,
  conditions: [],
  inferred: false,
  sentiment: "bullish",
  flags: ["sweep"],
};

const rule: AlertRule = {
  id: "r1",
  ticker: "NVDA",
  minPremium: 10_000,
  side: "ASK",
  flag: "sweep",
  maxDte: 30,
  otm: true,
  volOverOi: false,
};

describe("alert rules", () => {
  it("matches a sweep and refuses a rule that needs open interest", () => {
    const now = new Date("2026-11-13T16:00:00Z");
    expect(matchesRule(print, rule, now, 180)).toBe(true);
    expect(matchesRule(print, { ...rule, volOverOi: true }, now, 180)).toBe(false);
    expect(matchesRule(print, { ...rule, volOverOi: true }, now, 180, 5)).toBe(true);
    const seen = new Set<string>();
    expect(newHits([print], [{ ...rule, otm: false }], seen, now)).toHaveLength(1);
    expect(newHits([print], [rule], seen, now)).toHaveLength(0);
  });
});
