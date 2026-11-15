"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/live/status-pill";
import { TideLines } from "@/components/live/tide-lines";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { cumulativeTide } from "@/lib/flow/tape";
import { workerUrl } from "@/lib/live/worker";

export function SymbolFlow({ initial = "SPY", title }: { initial?: string; title: string }) {
  const feed = useWorkerFeed();
  const [symbol, setSymbol] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [detail, setDetail] = useState<{ nope: number | null; netCall: number; netPut: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = feed.prints.filter((print) => print.root === symbol);

  useEffect(() => {
    let stopped = false;
    fetch(`${workerUrl()}/v1/nope/${symbol}`)
      .then((response) => {
        if (!response.ok) throw new Error(`NOPE returned ${response.status}`);
        return response.json();
      })
      .then((body) => {
        if (stopped) return;
        setDetail({ nope: body.nope ?? null, netCall: body.tide?.netCallPremium ?? 0, netPut: body.tide?.netPutPremium ?? 0 });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "NOPE did not load.");
      });
    return () => {
      stopped = true;
    };
  }, [symbol]);

  return (
    <div className="flex flex-col gap-3">
      <StatusPill status={feed.status} replay={feed.replay} />
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSymbol(draft.trim().toUpperCase());
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value.toUpperCase())} className="h-8 w-28 rounded-md border border-border bg-card px-2 font-mono uppercase" aria-label="Ticker" />
        <Button type="submit" size="sm" variant="outline">Load</Button>
      </form>
      <h2 className="text-sm font-medium">{title}: {symbol}</h2>
      {error ? <p className="text-sm text-bearish">{error}</p> : null}
      {symbol === "SPX" ? <p className="text-sm text-muted-foreground">SPX itself is not in the polled universe. The chain is too large for a browser pull. This view is the worker net flow for the symbol you type. SPY is the liquid stand-in.</p> : null}
      <p className="text-sm">NOPE {detail?.nope == null ? "n/a" : detail.nope.toFixed(3)}. Net call ${((detail?.netCall ?? 0) / 1e6).toFixed(2)}M. Net put ${((detail?.netPut ?? 0) / 1e6).toFixed(2)}M.</p>
      <TideLines points={cumulativeTide(mine)} />
    </div>
  );
}
