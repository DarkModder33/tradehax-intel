import { describe, expect, it } from "vitest";
import type { FlowPrint } from "@/lib/flow/classify";
import type { AlertRule } from "./rules";
import { allowPush, dropOnGone, matchingPushes, pushConfigured } from "./push";

const print = {
  time: "2026-11-16T15:00:00Z",
  contract: "SPY261220C00600000",
  root: "SPY",
  expiry: "2026-12-20",
  strike: 600,
  right: "call",
  side: "ASK",
  size: 10,
  price: 2,
  premium: 2000,
  delta: 0.4,
  conditions: [],
  inferred: false,
  sentiment: "bullish",
  flags: [],
} satisfies FlowPrint;

const rule: AlertRule = { id: "r1", ticker: "SPY", minPremium: 1000, side: "ASK", flag: "any", maxDte: null, otm: false, volOverOi: false };

describe("web push", () => {
  it("matches a rule, rate-limits a repeat, and drops a gone subscription", () => {
    expect(pushConfigured({})).toBe(false);
    const payloads = matchingPushes([print], [rule], new Date("2026-11-16T15:00:00Z"));
    expect(payloads[0]?.symbol).toBe("SPY");
    const first = allowPush([], "SPY|r1", 1_000);
    expect(first.allowed).toBe(true);
    expect(allowPush(first.next, "SPY|r1", 2_000).allowed).toBe(false);
    expect(dropOnGone(410)).toBe(true);
    expect(dropOnGone(201)).toBe(false);
  });
});
