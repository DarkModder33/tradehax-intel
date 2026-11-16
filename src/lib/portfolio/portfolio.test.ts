import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/indicators/types";
import { CSV_PRESETS, mapCsv } from "./csv-map";
import { applyLedger, type Transaction } from "./ledger";
import { limitFill, marketFill } from "./paper-fill";
import { annualizedVol, beta } from "./risk";

function tx(partial: Partial<Transaction> & Pick<Transaction, "kind" | "qty" | "price">): Transaction {
  return { id: partial.kind + partial.qty, book: "real", time: partial.time ?? "2026-01-01", symbol: "AAA", multiplier: 1, ...partial };
}

describe("portfolio ledger", () => {
  it("uses FIFO on a partial sell and adjusts a split", () => {
    const book = applyLedger([
      tx({ kind: "buy", qty: 10, price: 10, time: "2026-01-01" }),
      tx({ kind: "buy", qty: 10, price: 20, time: "2026-01-02" }),
      tx({ kind: "sell", qty: 15, price: 30, time: "2026-01-03" }),
      tx({ kind: "split", qty: 2, price: 0, time: "2026-01-04" }),
    ]);
    const view = book.get("real:AAA");
    expect(view?.realized).toBeCloseTo(10 * 20 + 5 * 10, 6);
    expect(view?.qty).toBeCloseTo(10, 6);
    expect(view?.cost).toBeCloseTo(100, 6);
  });

  it("gives a short a positive P/L when the cover is lower, and uses the option multiplier", () => {
    const short = applyLedger([
      tx({ kind: "short", qty: 5, price: 40, time: "2026-01-01" }),
      tx({ kind: "cover", qty: 5, price: 30, time: "2026-01-02" }),
    ]);
    expect(short.get("real:AAA")?.realized).toBeCloseTo(50, 6);
    const option = applyLedger([
      tx({ kind: "buy", qty: 1, price: 2, time: "2026-01-01", symbol: "AAA261218C00100000", multiplier: 100 }),
      tx({ kind: "sell", qty: 1, price: 3, time: "2026-01-02", symbol: "AAA261218C00100000", multiplier: 100 }),
    ]);
    expect(option.get("real:AAA261218C00100000")?.realized).toBeCloseTo(100, 6);
  });

  it("maps three broker headers and fills a limit only when a bar trades through", () => {
    const sample = (header: string) => `${header}\nAAA,Buy,2,$10.00,2026-01-02`;
    expect(mapCsv(sample("symbol,side,quantity,price,date"), CSV_PRESETS.generic)[0]).toMatchObject({ symbol: "AAA", qty: 2, price: 10 });
    expect(mapCsv("Instrument,Trans Code,Quantity,Price,Activity Date\nAAA,Buy,1,$4,2026-01-01", CSV_PRESETS.robinhood)[0].symbol).toBe("AAA");
    expect(mapCsv("Symbol,Action,Quantity,Price,Run Date\nAAA,Buy,1,4,2026-01-01", CSV_PRESETS.fidelity)).toHaveLength(1);
    expect(mapCsv("Symbol,Action,Quantity,Price,Date\nAAA,Buy,1,4,2026-01-01", CSV_PRESETS.schwab)).toHaveLength(1);
    const bars: Bar[] = [
      { time: 1, open: 10, high: 11, low: 10, close: 10.5, volume: 1 },
      { time: 2, open: 10, high: 10.2, low: 9, close: 9.5, volume: 1 },
    ];
    expect(limitFill(bars, 9.5, 1)).toMatchObject({ filled: true, index: 1, price: 9.5 });
    expect(marketFill(10, 10, 1)).toBeCloseTo(10.01, 6);
    const asset = [0.01, 0.02, -0.01, 0.03, 0];
    const market = [0.01, 0.02, -0.01, 0.03, 0];
    expect(beta(asset, market)).toBeCloseTo(1, 6);
    expect(annualizedVol(asset)).toBeGreaterThan(0);
  });
});
