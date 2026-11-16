"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/live/status-pill";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { flowForward } from "@/lib/flow/backtest";
import type { FlowPrint } from "@/lib/flow/classify";
import { passesTapeFilter, OPEN_FILTER } from "@/lib/flow/tape";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";
import { workerUrl } from "@/lib/live/worker";

export function HistoryBoard() {
  const feed = useWorkerFeed();
  const [date, setDate] = useState("2026-11-13");
  const [ticker, setTicker] = useState("SPY");
  const [prints, setPrints] = useState<FlowPrint[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    fetch(`${workerUrl()}/v1/history?date=${date}&symbol=${ticker}`)
      .then((response) => response.json())
      .then((body) => {
        if (!stopped) setPrints(body.prints ?? []);
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "History did not load.");
      });
    return () => {
      stopped = true;
    };
  }, [date, ticker]);

  const shown = prints.filter((print) => passesTapeFilter(print, { ...OPEN_FILTER, ticker }, new Date(date)));

  return (
    <div className="flex flex-col gap-3">
      <StatusPill status={feed.status} replay={feed.replay} />
      <div className="flex gap-2">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-sm" />
        <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} className="h-8 w-24 rounded-md border border-border bg-card px-2 font-mono uppercase" aria-label="History ticker" />
      </div>
      {error ? <p className="text-sm text-bearish">{error}</p> : null}
      <p className="text-sm text-muted-foreground">{shown.length} prints. The worker only keeps what it has seen since it last started, plus the daily buckets it still has in memory.</p>
      <button
        type="button"
        className="w-fit rounded-md border border-border px-3 py-1 text-sm"
        onClick={() => {
          void (async () => {
            const chart = parseYahooChart(await (await fetch(yahooChartRequestUrl(ticker, "1d", "1y"))).json(), ticker);
            const closes = chart.bars.map((bar) => ({ date: new Date(bar.time).toISOString().slice(0, 10), close: bar.close }));
            const forward = flowForward(shown, closes, 1);
            setResult(`${forward.hits}/${forward.n} prints were followed by a next-day move in the called direction. Average ${(forward.average * 100).toFixed(2)}%. Wilson 95% ${(forward.wilsonLo * 100).toFixed(0)}–${(forward.wilsonHi * 100).toFixed(0)}%.`);
          })().catch((err: unknown) => setError(err instanceof Error ? err.message : "Backtest failed."));
        }}
      >
        What happened next day
      </button>
      {result ? <p className="text-sm">{result}</p> : null}
      <ul className="text-xs">
        {shown.slice(0, 40).map((print) => (
          <li key={`${print.contract}${print.time}${print.size}`}>{print.time.slice(11, 19)} {print.root} {print.right} {print.strike} {print.side} ${Math.round(print.premium)}</li>
        ))}
      </ul>
    </div>
  );
}
