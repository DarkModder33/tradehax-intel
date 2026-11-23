import { describe, expect, it } from "vitest";
import { amountMid, partyLetter, topTickers, type CongressRow } from "./congress-view";

const row = (over: Partial<CongressRow>): CongressRow => ({
  ticker: "NVDA", asset: "NVIDIA (NVDA)", type: "Purchase", owner: "Self", transactionDate: "2026-11-10",
  amount: "$1,001 - $15,000", amountLow: 1001, amountHigh: 15000, member: "A", party: "Democrat", district: "CA01",
  filed: "2026-11-12", url: "x", ...over,
});

describe("congress view", () => {
  it("ranks by distinct members, then trades", () => {
    const rows = [row({}), row({ member: "B", party: "Republican" }), row({ ticker: "AAPL", type: "Sale" }), row({ ticker: "AAPL" }), row({ ticker: "OLD", transactionDate: "2026-01-01" })];
    const top = topTickers(rows, "2026-10-01");
    expect(top[0]).toMatchObject({ ticker: "NVDA", members: 2, buys: 2 });
    expect(top[1]).toMatchObject({ ticker: "AAPL", members: 1, buys: 1, sells: 1 });
    expect(top.some((item) => item.ticker === "OLD")).toBe(false);
  });
  it("letters and midpoints", () => {
    expect(partyLetter("Democrat")).toBe("D");
    expect(partyLetter("Republican")).toBe("R");
    expect(partyLetter(null)).toBe("?");
    expect(amountMid({ amountLow: 1001, amountHigh: 15000 })).toBe(8000.5);
    expect(amountMid({ amountLow: 50000000, amountHigh: null })).toBe(50000000);
  });
});
