import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { amountBounds, houseParties, parsePtrText, splitDistrict } from "./congress";

const sample = readFileSync(path.join(__dirname, "fixtures", "ptr-sample.txt"), "utf8");

describe("House PTR parsing", () => {
  const trades = parsePtrText(sample);

  it("reads ticker, type, dates, and a wrapped amount", () => {
    expect(trades[0]).toMatchObject({ ticker: "ARE", type: "Purchase", transactionDate: "2026-10-20", notifiedDate: "2026-11-09", amount: "$1,001 - $15,000", amountLow: 1001, amountHigh: 15000, assetType: "ST" });
    const partial = trades.find((trade) => trade.ticker === "APP" && trade.type === "Partial sale");
    expect(partial?.amount).toBe("$15,001 - $50,000");
    expect(partial?.amountHigh).toBe(50000);
  });

  it("handles a type that shares a line with the ticker", () => {
    expect(trades.find((trade) => trade.ticker === "BNPQF")?.type).toBe("Sale");
  });

  it("finds every ticker row in the sample", () => {
    expect(trades.map((trade) => trade.ticker)).toEqual(["ARE", "LNT", "APP", "APP", "ARGX", "ARGX", "ARGX", "BNS", "BNPQF", "BBIO"]);
  });

  it("drops rows without a ticker", () => {
    const bill = "                       Treasury Bill (6-Week, Matures             P                 10/20/2026 10/20/2026             $15,001 -\n                       12/3/2026) [GS]                                                                                $50,000\n";
    expect(parsePtrText(bill)).toEqual([]);
  });

  it("parses amounts and districts", () => {
    expect(amountBounds("Over $50,000,000")).toEqual({ low: 50000000, high: null });
    expect(splitDistrict("CA31")).toEqual({ state: "CA", district: 31 });
    expect(splitDistrict("AK00")).toEqual({ state: "AK", district: 0 });
    const parties = houseParties([{ terms: [{ type: "rep", state: "CA", district: 31, party: "Democrat" }] }]);
    expect(parties.get("CA31")).toBe("Democrat");
  });
});
