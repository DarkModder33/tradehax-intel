import { describe, expect, it } from "vitest";
import { alertText, pickAlerts } from "../../../scripts/social/alerts.mjs";

const now = "2026-11-23T21:00:00Z";
const base = { source: "s", href: "/", detail: "d", sentiment: "Bullish" };
const sweep = (id: string, ticker: string, amount: number, at = "2026-11-23T20:40:00Z") => ({ ...base, id, ticker, type: "sweep", label: "Call sweep", value: "$1M", amount, at, seenAt: now });

describe("alert posting", () => {
  it("posts big fresh tape once per ticker, largest first, within the run cap", () => {
    const alerts = [sweep("a", "NVDA", 1_500_000), sweep("b", "NVDA", 3_000_000), sweep("c", "QQQ", 400_000), sweep("d", "SPY", 2_000_000, "2026-11-23T18:00:00Z")];
    expect(pickAlerts(alerts, { posted: {} }, { now }).map((alert: { id: string }) => alert.id)).toEqual(["b"]);
  });

  it("skips ledgered, stale and invalid alerts and honours the daily cap", () => {
    const mover = { ...base, id: "mover|AMD|2026-11-23", ticker: "AMD", type: "mover", label: "Big gainer", value: "+6.8%", at: "2026-11-23T21:00:00Z", seenAt: now };
    const old = { ...mover, id: "short|META|2026-10-30", ticker: "META", type: "short", at: "2026-10-30T21:00:00Z" };
    const broken = { ...mover, id: "x", ticker: "AMD", type: "congress", value: "NaN" };
    expect(pickAlerts([mover, old, broken], { posted: {} }, { now })).toHaveLength(1);
    expect(pickAlerts([mover], { posted: { "alert:mover|AMD|2026-11-23": ["telegram"] } }, { now })).toHaveLength(0);
    expect(pickAlerts([mover], { posted: {}, alertDays: { "2026-11-23": 30 } }, { now })).toHaveLength(0);
    expect(alertText({ ...mover })).toMatch(/^Nov 23 AMD {2}Big gainer {2}\+6\.8%/);
  });
});
