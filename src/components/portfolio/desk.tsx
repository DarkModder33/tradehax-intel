"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PAPER_INBOX_KEY } from "@/lib/options/strategy";
import { CSV_PRESETS, mapCsv, sideToKind } from "@/lib/portfolio/csv-map";
import { applyLedger, type BookId, type Transaction } from "@/lib/portfolio/ledger";
import { limitFill, marketFill } from "@/lib/portfolio/paper-fill";
import { annualizedVol, beta, logReturns, maxDrawdown } from "@/lib/portfolio/risk";
import { localGet, localSet } from "@/lib/store/idb";
import { fetchWorkerChart } from "@/lib/market/worker-bars";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";

const KEY = "tradehax-ledger";

export function PortfolioDesk() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [book, setBook] = useState<BookId>("paper");
  const [symbol, setSymbol] = useState("SPY");
  const [qty, setQty] = useState(1);
  const [limit, setLimit] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [riskText, setRiskText] = useState("Risk loads after a mark.");

  useEffect(() => {
    void localGet(KEY).then((raw) => {
      if (!raw) return;
      try {
        setRows(JSON.parse(raw) as Transaction[]);
      } catch {
        setRows([]);
      }
    });
  }, []);

  const save = async (next: Transaction[]) => {
    setRows(next);
    await localSet(KEY, JSON.stringify(next));
  };

  const positions = [...applyLedger(rows.filter((row) => row.book === book)).values()];

  const submit = async (kind: "buy" | "sell") => {
    const viaWorker = await fetchWorkerChart(symbol, "1d", "5d");
    const bars = viaWorker?.bars ?? parseYahooChart(await (await fetch(yahooChartRequestUrl(symbol, "1d", "1mo"))).json(), symbol).bars;
    const last = bars.at(-1)?.close;
    if (last == null) {
      setNote("No delayed price, so the paper order was not filled.");
      return;
    }
    const side = kind === "buy" ? 1 : -1;
    const limited = limit.trim() ? Number(limit) : null;
    const fill = limited != null ? limitFill(bars, limited, side) : { filled: true, price: marketFill(last, 5, side), index: bars.length - 1, label: "simulated, 15-min-delayed data" as const };
    if (!fill.filled || fill.price == null) {
      setNote("The limit has not traded through on the delayed bars. Nothing was filled.");
      return;
    }
    const option = symbol.length > 8;
    const tx: Transaction = {
      id: `${Date.now()}`,
      book,
      time: new Date().toISOString(),
      symbol,
      kind: side === 1 ? "buy" : "sell",
      qty,
      price: fill.price,
      multiplier: option ? 100 : 1,
    };
    await save([...rows, tx]);
    setMarks((current) => ({ ...current, [symbol]: last }));
    setNote(`${fill.label}. Filled ${qty} @ ${fill.price.toFixed(2)}. No order left this browser.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <DataBadge source="This browser only" delay="simulated, 15-min-delayed data" />
      <p className="text-xs text-muted-foreground">Paper fills never use the desk's broker keys. Quotes are delayed. Nothing here is sent to a broker.</p>
      <div className="flex gap-2 text-sm">
        {(["real", "paper"] as const).map((item) => (
          <button key={item} type="button" className={`h-9 rounded-full px-3 ${book === item ? "bg-foreground text-background" : ""}`} onClick={() => setBook(item)}>{item}</button>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void submit("buy"); }}>
        <label className="text-xs">Symbol<input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="mt-1 block h-10 w-40 rounded-md border border-border bg-card px-2 font-mono" /></label>
        <label className="text-xs">Qty<input type="number" value={qty} min={1} onChange={(event) => setQty(Number(event.target.value))} className="mt-1 block h-10 w-20 rounded-md border border-border bg-card px-2" /></label>
        <label className="text-xs">Limit<input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="market" className="mt-1 block h-10 w-24 rounded-md border border-border bg-card px-2" /></label>
        <button type="submit" className="h-10 rounded-full bg-foreground px-3 text-xs text-background">Buy</button>
        <button type="button" className="h-10 rounded-full px-3 text-xs" onClick={() => void submit("sell")}>Sell</button>
      </form>
      {note ? <p className="text-sm">{note}</p> : null}
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground"><th>Symbol</th><th>Qty</th><th>Cost</th><th>Realized</th><th>Mark</th></tr></thead>
        <tbody>
          {positions.filter((row) => row.qty !== 0 || row.realized !== 0).map((row) => (
            <tr key={row.symbol} className="border-t border-border/60">
              <td className="py-1 font-mono">{row.symbol}</td>
              <td>{row.qty}</td>
              <td>{row.cost.toFixed(2)}</td>
              <td>{row.realized.toFixed(2)}</td>
              <td>{marks[row.symbol] == null ? "—" : marks[row.symbol].toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="text-xs">
        Import CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            const header = text.split("\n")[0] ?? "";
            const preset = header.includes("Instrument") ? CSV_PRESETS.robinhood : header.includes("Run Date") ? CSV_PRESETS.fidelity : header.includes("Activity Date") ? CSV_PRESETS.robinhood : CSV_PRESETS.generic;
            const mapped = mapCsv(text, preset);
            const next = [...rows];
            for (const row of mapped) {
              const kind = sideToKind(row.side);
              if (!kind) continue;
              next.push({ id: `${row.date}-${row.symbol}-${next.length}`, book, time: row.date || new Date().toISOString(), symbol: row.symbol, kind, qty: row.qty, price: row.price, multiplier: row.symbol.length > 8 ? 100 : 1 });
            }
            await save(next);
            setNote(`Imported ${mapped.length} rows into the ${book} book. The file stayed in this browser.`);
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-9 rounded-full px-3 text-xs" onClick={() => {
          const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "tradehax-book.json";
          link.click();
          URL.revokeObjectURL(url);
        }}>Export JSON</button>
        <button type="button" className="h-9 rounded-full px-3 text-xs" onClick={async () => {
          const raw = localStorage.getItem(PAPER_INBOX_KEY);
          if (!raw) {
            setNote("Nothing is waiting from the strategy builder.");
            return;
          }
          const queued = JSON.parse(raw) as { symbol?: string; legs?: { symbol?: string; side: number; strike: number; premium: number; quantity: number; right: string }[] }[];
          const next = [...rows];
          for (const item of queued) {
            for (const leg of item.legs ?? []) {
              next.push({
                id: `${Date.now()}-${next.length}`,
                book: "paper",
                time: new Date().toISOString(),
                symbol: leg.symbol ?? `${item.symbol ?? "OPT"}${leg.right === "call" ? "C" : "P"}${leg.strike}`,
                kind: leg.side > 0 ? "buy" : "sell",
                qty: leg.quantity,
                price: leg.premium,
                multiplier: 100,
              });
            }
          }
          localStorage.removeItem(PAPER_INBOX_KEY);
          await save(next);
          setNote("Strategy legs moved into the paper book. Still simulated, still local.");
        }}>Take strategy legs</button>
        <button type="button" className="h-9 rounded-full px-3 text-xs" onClick={async () => {
          const spy = await fetchWorkerChart("SPY", "1d", "6mo");
          const spyBars = spy?.bars ?? parseYahooChart(await (await fetch(yahooChartRequestUrl("SPY", "1d", "6mo"))).json(), "SPY").bars;
          const market = logReturns(spyBars.map((bar) => bar.close));
          const first = positions[0]?.symbol;
          if (!first) {
            setRiskText("Add a position before beta is computed.");
            return;
          }
          const assetBars = await fetchWorkerChart(first, "1d", "6mo");
          const closes = assetBars?.bars ?? parseYahooChart(await (await fetch(yahooChartRequestUrl(first, "1d", "6mo"))).json(), first).bars;
          const asset = logReturns(closes.map((bar) => bar.close));
          const b = beta(asset, market);
          const vol = annualizedVol(asset);
          const dd = maxDrawdown(closes.map((bar) => bar.close));
          setRiskText(`${first} beta to SPY ${b == null ? "n/a" : b.toFixed(2)}, vol ${vol == null ? "n/a" : `${(vol * 100).toFixed(1)}%`}, max drawdown ${dd == null ? "n/a" : `${(dd * 100).toFixed(1)}%`}.`);
        }}>Risk</button>
      </div>
      <p className="text-sm text-muted-foreground">{riskText}</p>
    </div>
  );
}
