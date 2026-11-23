import { describe, expect, it } from "vitest";
import { congressAlerts, contractText, earningsAlerts, flowAlerts, formatAlertLine, insiderAlerts, mergeAlerts, money, moverAlerts, optionsAlerts, shortAlerts, validateAlert, type Alert } from "./feed";

const now = new Date("2026-11-23T21:00:00Z");

describe("alert feed", () => {
  it("formats money and contracts compactly", () => {
    expect(money(2_140_000)).toBe("$2.1M");
    expect(money(850_400)).toBe("$850K");
    expect(contractText("2027-03-19", 150, "call", now)).toBe("Mar '27 150C");
    expect(contractText("2026-12-04", 635, "put", now)).toBe("Dec 4 635P");
    expect(contractText("2026-03-20", 72.5, "call", new Date("2025-12-01T00:00:00Z"))).toBe("Mar '26 72.5C");
  });

  it("turns sweeps and blocks into one-liners and skips multi-leg and small prints", () => {
    const base = { contract: "NVDA270319C00150000", root: "NVDA", expiry: "2027-03-19", strike: 150, right: "call" as const, side: "ASK", size: 400, sentiment: "bullish" };
    const alerts = flowAlerts([
      { ...base, time: "2026-11-23T20:42:00Z", premium: 2_140_000, flags: ["sweep", "block"] },
      { ...base, time: "2026-11-23T20:43:00Z", premium: 2_140_000, flags: ["multileg", "block"] },
      { ...base, time: "2026-11-23T20:44:00Z", premium: 120_000, flags: ["sweep"] },
      { ...base, time: "2026-11-23T20:45:00Z", premium: 700_000, flags: ["block"], right: "put", side: "BID", sentiment: "bullish" },
    ], now);
    expect(alerts.map((alert) => alert.label)).toEqual(["Call sweep", "Put block"]);
    expect(formatAlertLine(alerts[0])).toBe("15:42 NVDA  Call sweep  $2.1M  Mar '27 150C ×400 at ask  Bullish");
  });

  it("flags volume spikes and gamma flips from the options history", () => {
    const quiet = Array.from({ length: 6 }, (_, i) => ({ date: `2026-11-1${i}`, spot: 100, callVolume: 60_000, putVolume: 40_000, netGex: 80_000_000 }));
    const alerts = optionsAlerts({ ABC: [...quiet, { date: "2026-11-17", spot: 98, callVolume: 300_000, putVolume: 100_000, netGex: -90_000_000, flip: 101.5 }] });
    expect(alerts.map((alert) => alert.type).sort()).toEqual(["flow-spike", "gamma-flip"]);
    const spike = alerts.find((alert) => alert.type === "flow-spike")!;
    expect(spike.value).toBe("4.0x avg");
    expect(spike.sentiment).toBe("Bullish");
    expect(alerts.find((alert) => alert.type === "gamma-flip")!.label).toBe("Gamma flip short");
  });

  it("needs two priced insider buys inside the window", () => {
    const row = (owner: string, filed: string, price = 10) => ({ filed, trade: { owner, ticker: "XYZ", code: "P", shares: 1000, price, acquired: true } });
    expect(insiderAlerts([row("A", "2026-11-20"), row("B", "2026-11-21")], "2026-11-23")[0].value).toBe("$20K");
    expect(insiderAlerts([row("A", "2026-11-20"), row("B", "2026-11-21", 0)], "2026-11-23")).toEqual([]);
    expect(insiderAlerts([row("A", "2026-10-01"), row("B", "2026-10-02")], "2026-11-23")).toEqual([]);
  });

  it("gates short interest, congress, earnings and movers", () => {
    expect(shortAlerts([{ symbolCode: "SPY", changePercent: 10.5, settlementDate: "2026-11-14" }, { symbolCode: "GME", changePercent: 22, settlementDate: "2026-11-14", daysToCoverQuantity: 3.2 }], "2026-11-23").map((a) => a.ticker)).toEqual(["GME"]);
    const congress = congressAlerts([
      { ticker: "AAPL", type: "Purchase", member: "Ed Case", party: "Democratic", amount: "$15,001 - $50,000", amountLow: 15001, transactionDate: "2026-11-16", filed: "2026-11-21", docId: "1" },
      { ticker: "MSFT", type: "Sale", member: "X Y", amountLow: 1001, filed: "2026-11-21", docId: "2" },
      { ticker: "NVDA", type: "Sale", member: "Hon. John James Jr.", party: "Republican", amount: "$15,001 - $50,000", amountLow: 15001, transactionDate: "2026-11-10", filed: "2026-11-20", docId: "4" },
      { ticker: "VZ", type: "Sale (Partial)", member: "Jo Smith", party: "Republican", amount: "$50,001 - $100,000", amountLow: 50001, transactionDate: "2026-11-02", filed: "2026-11-05", docId: "3" },
    ], "2026-11-23");
    expect(congress.map((a) => `${a.ticker} ${a.label} ${a.detail}`)).toEqual(["AAPL Congress buy Case (D), traded 11-16", "NVDA Congress sale James (R), traded 11-10"]);
    expect(earningsAlerts([{ sym: "WMT", reportDate: "2026-11-19", afterDate: "2026-11-20", realized: 0.005, implied: 0.062 }], "2026-11-23")[0].label).toBe("Earnings under implied");
    expect(earningsAlerts([{ sym: "WMT", reportDate: "2026-08-20", afterDate: "2026-08-21", realized: -0.09, implied: 0.05 }], "2026-11-23")).toEqual([]);
    expect(moverAlerts([{ ticker: "QQQ", date: "2026-11-23", close: 651.03, previous: 608.45 }, { ticker: "TLT", date: "2026-11-23", close: 81.7, previous: 81.4 }]).map((a) => a.value)).toEqual(["+7.0%"]);
  });

  it("validates and merges with first-seen times", () => {
    const alert: Alert = { id: "mover|QQQ|2026-11-23", at: "2026-11-23T21:00:00Z", ticker: "QQQ", type: "mover", label: "Big gainer", value: "+7.0%", detail: "close 651.03", sentiment: "Bullish", source: "x", href: "/t/?s=QQQ" };
    expect(validateAlert(alert, now)).toEqual([]);
    expect(validateAlert({ ...alert, value: "NaN%" }, now)).toContain("bad value");
    expect(validateAlert({ ...alert, ticker: "bad ticker" }, now)).toContain("bad ticker");
    const first = mergeAlerts([], [alert], now);
    const later = mergeAlerts(first, [{ ...alert, detail: "close 651.10" }], new Date("2026-11-23T22:00:00Z"));
    expect(later).toHaveLength(1);
    expect(later[0].seenAt).toBe(now.toISOString());
    expect(later[0].detail).toBe("close 651.10");
  });
});
