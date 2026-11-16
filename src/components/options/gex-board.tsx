"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { SymbolForm } from "@/components/options/symbol-form";
import { readSymbol } from "@/components/options/use-chain";
import { fetchChainSummary } from "@/lib/options/load-summary";
import type { ChainSummary } from "@/lib/options/summary";

function billions(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value / 1e9).toFixed(2)}B`;
}

export function GexBoard({ initial }: { initial?: string }) {
  const [symbol, setSymbol] = useState(initial ?? readSymbol);
  const [summary, setSummary] = useState<ChainSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
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
    };
  }, [symbol]);

  const cells = summary?.heatmap ?? [];
  const expiries = [...new Set(cells.map((cell) => cell.expiry))].slice(0, 8);
  const strikes = [...new Set(cells.filter((cell) => expiries.includes(cell.expiry)).map((cell) => cell.strike))].sort((a, b) => a - b);
  const max = Math.max(1, ...cells.map((cell) => Math.abs(cell.netGex)));
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
            <Level label="Gamma flip" value={summary.levels.flip == null ? "n/a" : summary.levels.flip.toFixed(2)} />
          </div>
          <p className="text-sm">
            Spot {summary.spot.toFixed(2)}. Regime: {summary.levels.regime}. Magnet {summary.levels.magnet ?? "n/a"}.
            {summary.expectedMove ? ` Expected move ${summary.expectedMove.low.toFixed(2)} to ${summary.expectedMove.high.toFixed(2)}.` : ""}
            {summary.levels.flips.length > 1 ? ` Nearby flips ${summary.levels.flips.map((flip) => flip.toFixed(1)).join(", ")}.` : ""}
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
          <section className="overflow-x-auto">
            <h2 className="mb-2 text-sm font-medium">Strike by expiry</h2>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-1 text-left">Strike</th>
                  {expiries.map((expiry) => (
                    <th key={expiry} className="p-1 text-left font-normal">{expiry.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {strikes.map((strike) => (
                  <tr key={strike}>
                    <td className="p-1 font-mono">{strike}</td>
                    {expiries.map((expiry) => {
                      const cell = cells.find((item) => item.expiry === expiry && item.strike === strike);
                      const value = cell?.netGex ?? 0;
                      const alpha = Math.min(0.85, Math.abs(value) / max);
                      const color = value >= 0 ? `oklch(0.8 0.15 155 / ${alpha})` : `oklch(0.72 0.16 22 / ${alpha})`;
                      return <td key={expiry} className="p-1" style={{ background: color }} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
