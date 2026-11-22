import { describe, expect, it } from "vitest";
import { clusterBuys } from "./form4";
import { parseInfoTable, quarterChange } from "./thirteenf";

const xml = `<infoTable><nameOfIssuer>Apple Inc</nameOfIssuer><cusip>037833100</cusip><value>1000</value><shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt></infoTable>`;

describe("filings parsers", () => {
  it("reads an info table, diffs quarters, and finds a cluster buy", () => {
    const rows = parseInfoTable(xml);
    expect(rows[0]).toMatchObject({ name: "Apple Inc", cusip: "037833100", value: 1000, shares: 10 });
    expect(quarterChange([{ cusip: "037833100", value: 400 }], rows)).toEqual([
      { cusip: "037833100", previous: 400, current: 1000, change: 600 },
    ]);
    const cluster = clusterBuys([
      { owner: "A", ticker: "AAPL", code: "P", date: "2026-11-01" },
      { owner: "B", ticker: "AAPL", code: "P", date: "2026-11-04" },
      { owner: "C", ticker: "AAPL", code: "S", date: "2026-11-05" },
      { owner: "D", ticker: "AAPL", code: "P", date: "2026-11-08" },
    ]);
    expect(cluster[0]?.count).toBe(3);
  });
});
