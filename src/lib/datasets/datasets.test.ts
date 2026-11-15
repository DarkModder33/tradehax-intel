import { describe, expect, it } from "vitest";
import { parsePtrLine, parseHouseIndex } from "./congress";
import { parseFtd } from "./ftd";
import { parseForm4 } from "./form4";
import { oiChanges } from "./oi";
import { matchQuery } from "./query";
import { monthlyReturns } from "./seasonality";

describe("precompute parsers", () => {
  it("reads a Form 4 purchase", () => {
    const xml = `<reportingOwner><reportingOwnerId><rptOwnerName>JANE DOE</rptOwnerName></reportingOwnerId></reportingOwner><issuer><issuerTradingSymbol>nvda</issuerTradingSymbol></issuer><transactionCode>P</transactionCode><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>12.5</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>`;
    expect(parseForm4(xml)).toMatchObject({ owner: "JANE DOE", ticker: "NVDA", code: "P", shares: 100, price: 12.5, acquired: true });
  });

  it("reads the House index and a PTR line", () => {
    const index = "Prefix\tLast\tFirst\tSuffix\tFilingType\tStateDst\tYear\tFilingDate\tDocID\nHon.\tYakym\tRudy C.\tIII\tP\tIN02\t2026\t10/20/2026\t20035691\n";
    expect(parseHouseIndex(index)[0]).toMatchObject({ name: "Hon. Rudy C. Yakym III", filingType: "P", docId: "20035691" });
    expect(parsePtrLine("JT Apple Inc (AAPL) P 11/01/2026 11/10/2026 $1,001 - $15,000")).toEqual({
      owner: "JT Apple Inc",
      ticker: "AAPL",
      kind: "P",
      amount: "$1,001 - $15,000",
    });
  });

  it("diffs open interest, parses fails-to-deliver, and scores a safe query", () => {
    expect(oiChanges([{ symbol: "SPY1", openInterest: 10 }], [{ symbol: "SPY1", openInterest: 4 }])).toEqual([
      { symbol: "SPY1", previous: 10, current: 4, change: -6 },
    ]);
    expect(parseFtd("20261113|123456789|SPY|50|SPDR|754.00\n")[0]).toMatchObject({ symbol: "SPY", quantity: 50, price: 754 });
    const row = { iv_rank: 90, sector: "Technology" };
    expect(matchQuery(row, 'iv_rank > 80 AND sector = "Technology"')).toBe(true);
    expect(matchQuery(row, "iv_rank < 80")).toBe(false);
  });

  it("summarizes a month of closes", () => {
    const stats = monthlyReturns([
      { date: "2026-01-30", close: 100 },
      { date: "2026-02-02", close: 110 },
      { date: "2026-02-03", close: 90 },
    ]);
    const february = stats.find((month) => month.month === 2);
    expect(february?.samples).toBe(2);
    expect(february?.positive).toBe(0.5);
  });
});
