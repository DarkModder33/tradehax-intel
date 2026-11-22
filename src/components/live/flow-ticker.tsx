"use client";
import { formatDigits } from "@/lib/format";

import { useWorkerFeed } from "@/components/live/use-worker-feed";

export function FlowTicker() {
  const feed = useWorkerFeed();
  const rows = feed.prints.slice(-8).reverse();
  if (!feed.connected) return null;
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border/70 px-3 py-1 text-[11px]" aria-label="Flow ticker">
      <span className="shrink-0 text-muted-foreground">{feed.status}</span>
      {rows.length === 0 ? <span className="text-muted-foreground">Waiting for prints</span> : null}
      {rows.map((print) => (
        <span key={`${print.contract}-${print.time}`} className={print.sentiment === "bullish" ? "shrink-0 text-bullish" : print.sentiment === "bearish" ? "shrink-0 text-bearish" : "shrink-0"}>
          {print.root} {print.right === "call" ? "C" : "P"} {print.strike} {print.side} ${formatDigits((print.premium / 1000), 0)}k
        </span>
      ))}
    </div>
  );
}
