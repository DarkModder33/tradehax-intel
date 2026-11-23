"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { workerConnected, workerUrl } from "@/lib/live/worker";
import { tickerPath } from "@/lib/ticker/route";
import { formatChange, formatDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const STRIP_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "IWM", label: "Russell 2000" },
  { symbol: "DIA", label: "Dow 30" },
  { symbol: "TLT", label: "20Y Treasury" },
  { symbol: "GLD", label: "Gold" },
] as const;

export interface StripRow {
  symbol: string;
  price: number;
  change: number;
  spark: number[];
}

/** Last daily close against the one before it. Null for blank, zero, or short input. */
export function stripRow(symbol: string, bars: Array<{ close?: unknown }>): StripRow | null {
  const closes = bars.map((bar) => Number(bar?.close)).filter((value) => Number.isFinite(value) && value > 0);
  if (closes.length < 2) return null;
  const price = closes[closes.length - 1];
  const previous = closes[closes.length - 2];
  return { symbol, price, change: ((price - previous) / previous) * 100, spark: closes.slice(-20) };
}

function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 64},${20 - ((value - min) / span) * 18 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 64 20" className="hidden h-5 w-14 shrink-0 xl:block" aria-hidden="true">
      <polyline points={points} fill="none" stroke={up ? "#61da92" : "#f97676"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketStrip() {
  const [rows, setRows] = useState<Record<string, StripRow | null>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!workerConnected()) {
      const off = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(off);
    }
    let stop = false;
    const load = async () => {
      const results = await Promise.all(
        STRIP_SYMBOLS.map(async ({ symbol }) => {
          try {
            const response = await fetch(`${workerUrl()}/v1/bars/${symbol}?tf=1Day&limit=21`, { cache: "no-store" });
            if (!response.ok) return [symbol, null] as const;
            const body = (await response.json()) as { bars?: Array<{ close?: unknown }> };
            return [symbol, stripRow(symbol, body.bars ?? [])] as const;
          } catch {
            return [symbol, null] as const;
          }
        }),
      );
      if (stop) return;
      setRows(Object.fromEntries(results));
      setFailed(results.every(([, row]) => row == null));
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section aria-label="Market strip" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="surface grid min-w-[720px] grid-cols-6 divide-x divide-white/[0.05] md:min-w-0">
        {STRIP_SYMBOLS.map(({ symbol, label }) => {
          const row = rows[symbol];
          const loading = !(symbol in rows) && !failed;
          const up = (row?.change ?? 0) >= 0;
          return (
            <Link
              key={symbol}
              href={tickerPath(symbol)}
              className="flex items-center justify-between gap-2 px-3 py-2.5 transition-colors first:rounded-l-lg last:rounded-r-lg hover:bg-white/[0.02]"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{symbol}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
              </span>
              {loading ? (
                <span className="h-8 w-20 animate-pulse rounded bg-white/[0.06]" />
              ) : row ? (
                <span className="flex shrink-0 items-center gap-2">
                  <Spark values={row.spark} up={up} />
                  <span className="text-right font-mono tabular-nums">
                    <span className="block text-xs">{formatDigits(row.price, 2)}</span>
                    <span className={cn("block text-[11px]", up ? "text-bullish" : "text-bearish")}>{formatChange(row.change)}</span>
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">n/a</span>
              )}
            </Link>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Change vs prior close. Alpaca SIP via worker, about 15 min delayed.</p>
    </section>
  );
}
