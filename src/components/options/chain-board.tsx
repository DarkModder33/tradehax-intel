"use client";

import { useMemo, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { SymbolForm } from "@/components/options/symbol-form";
import { readSymbol, useChain } from "@/components/options/use-chain";
import type { ChainContract } from "@/lib/sources/cboe";

export function ChainBoard() {
  const [symbol, setSymbol] = useState(readSymbol);
  const { chain, error, loading } = useChain(symbol);
  const expiries = useMemo(() => [...new Set(chain?.contracts.map((contract) => contract.expiry) ?? [])], [chain]);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChainContract | null>(null);
  const active = expiry && expiries.includes(expiry) ? expiry : expiries[0];
  const rows = chain && active ? group(chain.contracts.filter((contract) => contract.expiry === active), chain.spot) : [];

  return (
    <div className="flex flex-col gap-4">
      <SymbolForm symbol={symbol} onSubmit={setSymbol} />
      {loading ? <p className="text-sm text-muted-foreground">Reading the delayed chain.</p> : null}
      {error ? <p className="rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">{error}</p> : null}
      {chain ? (
        <>
          <DataBadge source={chain.source} asOf={chain.asOf} delay={chain.delay} />
          <label className="text-sm">
            Expiry{" "}
            <select value={active ?? ""} onChange={(event) => setExpiry(event.target.value)} className="ml-2 h-8 rounded-md border border-border bg-card px-2">
              {expiries.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  {["Call bid", "Ask", "IV", "Delta", "Vol", "OI", "Strike", "OI", "Vol", "Delta", "IV", "Bid", "Put ask"].map((label) => (
                    <th key={label} className="px-1 py-1 text-right font-normal">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.strike} className="border-t border-border/60">
                    <QuoteCells contract={row.call} itm={row.strike < chain.spot} onPick={setSelected} />
                    <td className="px-1 py-1 text-center font-mono">{row.strike}</td>
                    <QuoteCells contract={row.put} itm={row.strike > chain.spot} onPick={setSelected} mirror />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? <ContractCard contract={selected} onClose={() => setSelected(null)} /> : null}
        </>
      ) : null}
    </div>
  );
}

function group(contracts: ChainContract[], spot: number) {
  const strikes = [...new Set(contracts.map((contract) => contract.strike))].sort((a, b) => a - b);
  const near = strikes.filter((strike) => Math.abs(strike - spot) / spot <= 0.08);
  return (near.length ? near : strikes.slice(0, 40)).map((strike) => ({
    strike,
    call: contracts.find((contract) => contract.strike === strike && contract.right === "call") ?? null,
    put: contracts.find((contract) => contract.strike === strike && contract.right === "put") ?? null,
  }));
}

function QuoteCells({
  contract,
  itm,
  onPick,
  mirror = false,
}: {
  contract: ChainContract | null;
  itm: boolean;
  onPick: (contract: ChainContract) => void;
  mirror?: boolean;
}) {
  const cells = contract
    ? [contract.bid, contract.ask, contract.iv, contract.delta, contract.volume, contract.openInterest]
    : [null, null, null, null, null, null];
  const ordered = mirror ? [...cells].reverse() : cells;
  return (
    <>
      {ordered.map((value, index) => (
        <td key={index} className={itm ? "bg-foreground/5 px-1 py-1 text-right font-mono" : "px-1 py-1 text-right font-mono"}>
          {contract && index === (mirror ? 5 : 0) ? (
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => onPick(contract)}>
              {format(value)}
            </button>
          ) : (
            format(value)
          )}
        </td>
      ))}
    </>
  );
}

function format(value: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return value.toFixed(2);
}

function ContractCard({ contract, onClose }: { contract: ChainContract; onClose: () => void }) {
  return (
    <section className="rounded-2xl bg-card/80 p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-mono text-sm">{contract.symbol}</h2>
        <button type="button" className="text-xs text-muted-foreground" onClick={onClose}>Close</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <p>Bid {contract.bid.toFixed(2)} / ask {contract.ask.toFixed(2)}</p>
        <p>Last {contract.last.toFixed(2)}</p>
        <p>Volume {contract.volume.toFixed(0)} · OI {contract.openInterest.toFixed(0)}</p>
        <p>IV {(contract.iv * 100).toFixed(1)}%</p>
        <p>Delta {contract.delta.toFixed(3)}</p>
        <p>Gamma {contract.gamma.toFixed(4)}</p>
        <p>Theta {contract.theta.toFixed(4)}</p>
        <p>Vega {contract.vega.toFixed(4)}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Intraday side history needs the live worker. This card is the delayed snapshot only.
      </p>
    </section>
  );
}
