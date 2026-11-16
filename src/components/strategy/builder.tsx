"use client";

import { useEffect, useMemo, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { ChainPicker } from "@/components/strategy/chain-picker";
import { PnlChart } from "@/components/strategy/pnl-chart";
import { PnlHeatmap } from "@/components/strategy/pnl-heatmap";
import { StrategySummary } from "@/components/strategy/summary";
import { readSymbol, useChain } from "@/components/options/use-chain";
import { PAPER_INBOX_KEY, PRESETS, decodeLegs, encodeLegs, presetLegs, type PresetKind, type StockHedge, type StrategyLeg } from "@/lib/options/strategy";

export function StrategyBuilder() {
  const [symbol, setSymbol] = useState(readSymbol);
  const { chain, error, loading } = useChain(symbol);
  const [expiry, setExpiry] = useState("");
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [hedge, setHedge] = useState<StockHedge | null>(null);
  const [shift, setShift] = useState(0);
  const [natural, setNatural] = useState(false);

  const expiries = useMemo(() => [...new Set(chain?.contracts.map((contract) => contract.expiry) ?? [])].sort(), [chain]);
  useEffect(() => {
    if (!expiry && expiries[0]) setExpiry(expiries[0]);
  }, [expiry, expiries]);
  useEffect(() => {
    const raw = window.location.hash.replace(/^#legs=/, "");
    if (!raw || window.location.hash.indexOf("#legs=") !== 0) return;
    const book = decodeLegs(raw);
    if (book) {
      setLegs(book.legs);
      setHedge(book.hedge);
    }
  }, []);

  const priced = legs.map((leg) => {
    if (leg.bid == null || leg.ask == null || leg.bid <= 0 || leg.ask <= 0) return leg;
    const premium = natural ? (leg.side > 0 ? leg.ask : leg.bid) : (leg.bid + leg.ask) / 2;
    return { ...leg, premium };
  });
  const asOf = new Date();

  const applyPreset = (kind: PresetKind) => {
    if (!chain || !expiry) return;
    const book = presetLegs(chain, expiry, kind);
    setLegs(book.legs);
    setHedge(book.hedge);
    window.location.hash = `legs=${encodeLegs(book.legs, book.hedge)}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setSymbol(String(data.get("symbol") ?? symbol).toUpperCase());
          setLegs([]);
          setHedge(null);
        }}
      >
        <input name="symbol" defaultValue={symbol} aria-label="Symbol" className="h-10 w-28 rounded-md border border-border bg-card px-2 font-mono text-sm" />
        <button type="submit" className="h-10 rounded-full px-3 text-xs">Load chain</button>
      </form>
      {loading ? <p className="text-sm text-muted-foreground">Reading the delayed chain.</p> : null}
      {error ? <p className="rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">{error}</p> : null}
      {chain ? <DataBadge source={chain.source} asOf={chain.asOf} delay={chain.delay} /> : null}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((kind) => (
          <button key={kind} type="button" onClick={() => applyPreset(kind)} className="h-8 rounded-full px-2 text-[11px] text-muted-foreground hover:text-foreground">
            {kind}
          </button>
        ))}
      </div>
      <label className="text-xs text-muted-foreground">
        Expiry
        <select value={expiry} onChange={(event) => setExpiry(event.target.value)} className="ml-2 h-8 rounded-md border border-border bg-card px-2">
          {expiries.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      {chain && expiry ? <ChainPicker contracts={chain.contracts} expiry={expiry} onAdd={(leg) => setLegs((current) => [...current, leg])} /> : null}
      <ul className="text-sm">
        {priced.map((leg, index) => (
          <li key={`${leg.symbol ?? leg.strike}-${index}`} className="flex items-center justify-between gap-2 border-t border-border/50 py-1">
            <span>{leg.side > 0 ? "Buy" : "Sell"} {leg.quantity} {leg.expiry} {leg.strike} {leg.right} @ {leg.premium.toFixed(2)} {leg.symbol ? `(${leg.symbol})` : ""}</span>
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setLegs((current) => current.filter((_, item) => item !== index))}>Remove</button>
          </li>
        ))}
        {hedge ? <li>Stock {hedge.shares} shares from {hedge.entry.toFixed(2)}</li> : null}
      </ul>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label>IV shift {shift > 0 ? "+" : ""}{shift} vol pts
          <input type="range" min={-20} max={20} value={shift} onChange={(event) => setShift(Number(event.target.value))} className="ml-2 align-middle" />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={natural} onChange={(event) => setNatural(event.target.checked)} />
          Natural (buy ask, sell bid). Off uses the mid.
        </label>
        <button
          type="button"
          className="h-8 rounded-full px-3"
          onClick={() => {
            window.location.hash = `legs=${encodeLegs(legs, hedge)}`;
            void navigator.clipboard.writeText(window.location.href);
          }}
        >
          Share
        </button>
        <button
          type="button"
          className="h-8 rounded-full bg-foreground px-3 text-background"
          onClick={() => {
            const current = JSON.parse(localStorage.getItem(PAPER_INBOX_KEY) || "[]") as unknown[];
            current.push({ legs, hedge, symbol, at: Date.now() });
            localStorage.setItem(PAPER_INBOX_KEY, JSON.stringify(current));
          }}
        >
          Send to paper
        </button>
      </div>
      {priced.length && chain ? (
        <>
          <StrategySummary legs={priced} hedge={hedge} spot={chain.spot} asOf={asOf} ivShift={shift / 100} />
          <PnlChart legs={priced} hedge={hedge} spot={chain.spot} asOf={asOf} ivShift={shift / 100} />
          <p className="text-[11px] text-muted-foreground">Gold is now, then one third and two thirds of the way to expiry, then expiry. The logo is the TradingView attribution.</p>
          <PnlHeatmap legs={priced} hedge={hedge} spot={chain.spot} asOf={asOf} ivShift={shift / 100} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Add a leg from the chain, or start from a preset. Presets fill around the money for the expiry you picked.</p>
      )}
    </div>
  );
}
