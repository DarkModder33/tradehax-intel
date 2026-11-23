"use client";
import { formatDigits } from "@/lib/format";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { SymbolForm } from "@/components/options/symbol-form";
import { readSymbol } from "@/components/options/use-chain";
import { fetchChainSummary } from "@/lib/options/load-summary";
import { GexHeatmap } from "@/components/options/gex-heatmap";
import type { ChainSummary } from "@/lib/options/summary";

function billions(value: number): string {
  return `${value < 0 ? "−" : ""}$${formatDigits(Math.abs(value / 1e9), 2)}B`;
}

export function GexBoard({ initial }: { initial?: string }) {
  const [symbol, setSymbol] = useState(initial ?? readSymbol);
  const [summary, setSummary] = useState<ChainSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    const timer = window.setTimeout(() => setLoading(true), 0);
    fetchChainSummary(symbol)
      .then((next) => {
        if (stopped) return;
        setSummary(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (stopped) return;
        setSummary(null);
        setError(err instanceof Error ? err.message : "The gamma book did not load.");
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [symbol]);

  const cells = summary?.heatmap ?? [];
  const near = summary?.near ?? [];
  const span = Math.max(1, ...near.map((row) => Math.max(row.callGex, row.putGex)));

  return (
    <div className="flex flex-col gap-4">
      <SymbolForm symbol={symbol} onSubmit={setSymbol} />
      {loading ? <PanelState kind="loading" detail="Reading the delayed chain." /> : null}
      {error ? <PanelState kind="error" detail={error} /> : null}
      {summary ? (
        <>
          <DataBadge source={summary.source} asOf={summary.asOf} delay={summary.delay} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Level label="Net gamma / 1%" value={billions(summary.levels.netGex)} />
            <Level label="Call wall" value={summary.levels.callWall?.toString() ?? "n/a"} />
            <Level label="Put wall" value={summary.levels.putWall?.toString() ?? "n/a"} />
            <Level label="Gamma flip" value={summary.levels.flip == null ? "n/a" : formatDigits(summary.levels.flip, 2)} />
          </div>
          <p className="text-sm">
            Spot {formatDigits(summary.spot, 2)}. Regime: {summary.levels.regime}. Magnet {summary.levels.magnet ?? "n/a"}.
            {summary.expectedMove ? ` Expected move ${formatDigits(summary.expectedMove.low, 2)} to ${formatDigits(summary.expectedMove.high, 2)}.` : ""}
            {summary.levels.flips.length > 1 ? ` Nearby flips ${summary.levels.flips.map((flip) => formatDigits(flip, 1)).join(", ")}.` : ""}
          </p>
          <section>
            <h2 className="mb-2 text-sm font-medium">By strike, near the spot</h2>
            <div className="flex flex-col gap-1">
              {near.map((row) => (
                <div key={row.strike} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-xs">
                  <span className="font-mono">{row.strike}</span>
                  <Bar width={row.callGex / span} className="bg-bullish" />
                  <Bar width={row.putGex / span} className="bg-bearish" />
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Green is call gamma. Red is put gamma. The sign of net gamma is calls minus puts.</p>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold">Gamma heatmap: strike by expiry</h2>
            <p className="mb-2 text-xs text-muted-foreground">Where dealer gamma sits across the next expiries, within 5% of spot. The outlined row is spot.</p>
            <GexHeatmap cells={cells} spot={summary.spot} flip={summary.levels.flip} callWall={summary.levels.callWall} putWall={summary.levels.putWall} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg">{value}</p>
    </div>
  );
}

function Bar({ width, className }: { width: number; className: string }) {
  return (
    <div className="h-2 rounded-full bg-foreground/10">
      <div className={`h-2 rounded-full ${className}`} style={{ width: `${Math.min(100, width * 100)}%` }} />
    </div>
  );
}
