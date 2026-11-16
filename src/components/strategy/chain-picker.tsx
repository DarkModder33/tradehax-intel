"use client";

import type { ChainContract } from "@/lib/sources/cboe";
import type { StrategyLeg } from "@/lib/options/strategy";

function price(contract: ChainContract, mode: "bid" | "ask" | "mid"): number {
  if (mode === "bid") return contract.bid || contract.last;
  if (mode === "ask") return contract.ask || contract.last;
  if (contract.bid > 0 && contract.ask > 0) return (contract.bid + contract.ask) / 2;
  return contract.last || contract.theo;
}

export function ChainPicker({
  contracts,
  expiry,
  onAdd,
}: {
  contracts: ChainContract[];
  expiry: string;
  onAdd: (leg: StrategyLeg) => void;
}) {
  const rows = contracts.filter((contract) => contract.expiry === expiry);
  const strikes = [...new Set(rows.map((contract) => contract.strike))].sort((a, b) => b - a).slice(0, 24);
  const add = (contract: ChainContract, mode: "bid" | "ask" | "mid", side: 1 | -1) => {
    onAdd({
      right: contract.right,
      side,
      strike: contract.strike,
      premium: price(contract, mode),
      quantity: 1,
      expiry: contract.expiry,
      iv: contract.iv > 1 ? contract.iv / 100 : contract.iv,
      symbol: contract.symbol,
      bid: contract.bid,
      ask: contract.ask,
    });
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="p-1">Call bid</th>
            <th className="p-1">Call ask</th>
            <th className="p-1">Strike</th>
            <th className="p-1">Put bid</th>
            <th className="p-1">Put ask</th>
          </tr>
        </thead>
        <tbody>
          {strikes.map((strike) => {
            const call = rows.find((contract) => contract.right === "call" && contract.strike === strike);
            const put = rows.find((contract) => contract.right === "put" && contract.strike === strike);
            return (
              <tr key={strike} className="border-t border-border/60">
                <td className="p-1">{call ? <QuoteButton contract={call} field="bid" onAdd={add} /> : "—"}</td>
                <td className="p-1">{call ? <QuoteButton contract={call} field="ask" onAdd={add} /> : "—"}</td>
                <td className="p-1 font-mono">{strike}</td>
                <td className="p-1">{put ? <QuoteButton contract={put} field="bid" onAdd={add} /> : "—"}</td>
                <td className="p-1">{put ? <QuoteButton contract={put} field="ask" onAdd={add} /> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-muted-foreground">Click a bid to sell, an ask to buy. Shift-click uses the mid.</p>
    </div>
  );
}

function QuoteButton({
  contract,
  field,
  onAdd,
}: {
  contract: ChainContract;
  field: "bid" | "ask";
  onAdd: (contract: ChainContract, mode: "bid" | "ask" | "mid", side: 1 | -1) => void;
}) {
  const shown = field === "bid" ? contract.bid : contract.ask;
  return (
    <button
      type="button"
      className="h-8 min-w-12 rounded-md px-1 font-mono hover:bg-foreground/10"
      onClick={(event) => onAdd(contract, event.shiftKey ? "mid" : field, field === "bid" ? -1 : 1)}
    >
      {shown ? shown.toFixed(2) : "—"}
    </button>
  );
}
