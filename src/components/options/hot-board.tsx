"use client";

import { useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { SymbolForm } from "@/components/options/symbol-form";
import { readSymbol, useChain } from "@/components/options/use-chain";
import { contractPremium, hotContracts } from "@/lib/options/hot";

export function HotBoard() {
  const [symbol, setSymbol] = useState(readSymbol);
  const { chain, error, loading } = useChain(symbol);
  const rows = chain ? hotContracts(chain.contracts).slice(0, 40) : [];

  return (
    <div className="flex flex-col gap-4">
      <SymbolForm symbol={symbol} onSubmit={setSymbol} />
      {loading ? <p className="text-sm text-muted-foreground">Reading the delayed chain.</p> : null}
      {error ? <p className="rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">{error}</p> : null}
      {chain ? (
        <>
          <DataBadge source={chain.source} asOf={chain.asOf} delay={chain.delay} inferred inferredReason="Side of the trade is not in a delayed snapshot. Ask and bid percentages need the live diff." />
          <p className="text-sm">{hotContracts(chain.contracts).length} contracts with volume above open interest and at least $10k of last-trade premium. Side is n/a until the live feed is connected.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  {["Contract", "Expiry", "Strike", "Vol", "OI", "Premium", "IV", "Delta"].map((label) => (
                    <th key={label} className="px-2 py-1 text-right font-normal">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((contract) => (
                  <tr key={contract.symbol} className="border-t border-border/60">
                    <td className="px-2 py-1 text-left font-mono">{contract.right === "call" ? "Call" : "Put"}</td>
                    <td className="px-2 py-1 text-right">{contract.expiry}</td>
                    <td className="px-2 py-1 text-right font-mono">{contract.strike}</td>
                    <td className="px-2 py-1 text-right">{contract.volume.toFixed(0)}</td>
                    <td className="px-2 py-1 text-right">{contract.openInterest.toFixed(0)}</td>
                    <td className="px-2 py-1 text-right">${Math.round(contractPremium(contract)).toLocaleString("en-US")}</td>
                    <td className="px-2 py-1 text-right">{(contract.iv * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1 text-right">{contract.delta.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
