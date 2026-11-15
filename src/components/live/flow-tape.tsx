"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/live/status-pill";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { formatEt } from "@/lib/format";
import { OPEN_FILTER, daysToExpiry, passesTapeFilter, type TapeFilter } from "@/lib/flow/tape";

function money(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function FlowTape() {
  const feed = useWorkerFeed();
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(feed.prints);
  const [filter, setFilter] = useState<TapeFilter>(OPEN_FILTER);
  const source = paused ? frozen : feed.prints;
  const rows = useMemo(
    () => source.filter((print) => passesTapeFilter(print, filter, new Date())).slice().reverse(),
    [source, filter],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={feed.status} replay={feed.replay} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setPaused((value) => {
              if (!value) setFrozen(feed.prints);
              return !value;
            });
          }}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
      <div className="flex flex-wrap gap-2 text-xs">
        <label>Min premium
          <input type="number" value={filter.minPremium} onChange={(event) => setFilter({ ...filter, minPremium: Number(event.target.value) })} className="ml-1 h-7 w-24 rounded-md border border-border bg-card px-2" />
        </label>
        <label>Ticker
          <input value={filter.ticker} onChange={(event) => setFilter({ ...filter, ticker: event.target.value.toUpperCase() })} className="ml-1 h-7 w-20 rounded-md border border-border bg-card px-2 font-mono uppercase" />
        </label>
        <label>Max DTE
          <input type="number" value={filter.maxDte ?? ""} placeholder="any" onChange={(event) => setFilter({ ...filter, maxDte: event.target.value === "" ? null : Number(event.target.value) })} className="ml-1 h-7 w-16 rounded-md border border-border bg-card px-2" />
        </label>
        <select value={filter.right} onChange={(event) => setFilter({ ...filter, right: event.target.value as TapeFilter["right"] })} className="h-7 rounded-md border border-border bg-card px-2">
          <option value="all">Calls and puts</option>
          <option value="call">Calls</option>
          <option value="put">Puts</option>
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={filter.sweepsOnly} onChange={(event) => setFilter({ ...filter, sweepsOnly: event.target.checked })} /> Sweeps</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={filter.otmOnly} onChange={(event) => setFilter({ ...filter, otmOnly: event.target.checked })} /> OTM</label>
        <Button type="button" size="sm" variant={filter.unusual ? "default" : "outline"} onClick={() => setFilter({ ...filter, unusual: !filter.unusual, minPremium: filter.unusual ? filter.minPremium : 10_000 })}>
          Unusual
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Side is inferred from the print versus the delayed quote. Spot, open interest, and IV are not on this feed, so OTM uses no spot unless you leave that filter off. Green is bullish (call at the ask or put at the bid). Red is the other way.</p>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-muted-foreground">
            <tr>
              {["Time", "Ticker", "Exp", "Strike", "C/P", "Side", "Size", "Premium", "Tags"].map((label) => (
                <th key={label} className="px-2 py-1 text-right font-normal">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((print) => (
              <tr key={`${print.contract}-${print.time}-${print.size}`} className={`border-t border-border/50 ${print.sentiment === "bullish" ? "text-bullish" : print.sentiment === "bearish" ? "text-bearish" : ""}`}>
                <td className="px-2 py-1 text-right whitespace-nowrap">{formatEt(Date.parse(print.time))}</td>
                <td className="px-2 py-1 text-right font-mono">{print.root}</td>
                <td className="px-2 py-1 text-right">{print.expiry.slice(5)} · {Math.max(0, Math.round(daysToExpiry(print.expiry, new Date())))}d</td>
                <td className="px-2 py-1 text-right font-mono">{print.strike}</td>
                <td className="px-2 py-1 text-right">{print.right === "call" ? "C" : "P"}</td>
                <td className="px-2 py-1 text-right">{print.side}{print.inferred ? " · inferred" : ""}</td>
                <td className="px-2 py-1 text-right">{print.size}</td>
                <td className="px-2 py-1 text-right">{money(print.premium)}</td>
                <td className="px-2 py-1 text-right">{print.flags.filter((flag) => flag === "sweep" || flag === "block" || flag === "multileg").join(" ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
