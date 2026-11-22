"use client";
import { formatDigits } from "@/lib/format";

import { useMemo, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { deflatedSharpe, mean, stdev } from "@/lib/stats/dsr";
import { wilson } from "@/lib/stats/intervals";
import { walkForwardFolds } from "@/lib/stats/walkforward";
import { costBpsPerSide } from "@/lib/engine/costs";
import { decodeStrategy, encodeStrategy, smaCross, type StrategySpec } from "@/lib/backtest/rules";
import { metricsOf } from "@/lib/backtest/metrics";
import { simulate } from "@/lib/backtest/simulate";
import { countTrials, sweepSharpe } from "@/lib/backtest/sweep";
import { fetchWorkerChart } from "@/lib/market/worker-bars";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";
import type { Bar } from "@/lib/indicators/types";

const PRESETS: { name: string; spec: StrategySpec }[] = [
  { name: "SMA cross", spec: smaCross(50, 200) },
  {
    name: "RSI mean reversion",
    spec: {
      side: "long",
      sizePct: 1,
      entry: { join: "AND", conditions: [{ left: { name: "rsi", period: 14 }, op: "<", right: 30 }] },
      exit: { join: "AND", conditions: [{ left: { name: "rsi", period: 14 }, op: ">", right: 50 }] },
    },
  },
  {
    name: "Turn of month",
    spec: {
      side: "long",
      sizePct: 1,
      timeStop: 3,
      entry: { join: "AND", conditions: [{ left: { name: "dow" }, op: ">", right: 0 }] },
      exit: { join: "AND", conditions: [] },
    },
  },
];

export function BacktestLab() {
  const [symbol, setSymbol] = useState("SPY");
  const [spec, setSpec] = useState<StrategySpec>(PRESETS[0].spec);
  const [source, setSource] = useState("Bars");
  const [error, setError] = useState<string | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [trials, setTrials] = useState(1);
  const [running, setRunning] = useState(false);

  const result = useMemo(() => {
    if (bars.length < 30) return null;
    const years = Math.max(1 / 252, (bars[bars.length - 1].time - bars[0].time) / (365 * 24 * 60 * 60 * 1000));
    const run = simulate(bars, spec, { costBps: costBpsPerSide(symbol, bars) });
    const buyHold = bars[bars.length - 1].close / bars[0].close - 1;
    const stats = metricsOf(run.equity, run.trades, bars.length, years, buyHold);
    const returns = run.equity.slice(1).map((value, index) => (run.equity[index] > 0 ? value / run.equity[index] - 1 : 0));
    const dsr = deflatedSharpe({
      sharpe: stats.volatility === 0 ? 0 : mean(returns) / (stdev(returns) || 1e-8),
      trials,
      sharpeVariance: Math.max(1e-4, stdev(returns) ** 2),
      skew: 0,
      kurtosis: 3,
      observations: returns.length,
    });
    const wins = run.trades.filter((trade) => trade.pnl > 0).length;
    return { run, stats, dsr, wilson: wilson(wins, run.trades.length), folds: walkForwardFolds(bars.length, { horizon: 5 }).length };
  }, [bars, spec, symbol, trials]);

  const runBacktest = async (next = spec) => {
    setRunning(true);
    setError(null);
    try {
      const viaWorker = await fetchWorkerChart(symbol, "1d", "10y");
      const loaded = viaWorker?.bars.length
        ? { bars: viaWorker.bars, source: "Alpaca SIP via worker" }
        : { bars: parseYahooChart(await (await fetch(yahooChartRequestUrl(symbol, "1d", "10y"))).json(), symbol).bars, source: "Yahoo Finance via proxy" };
      setBars(loaded.bars);
      setSource(loaded.source);
      setSpec(next);
      setTrials((count) => count + 1);
      window.location.hash = `s=${encodeStrategy(next)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The backtest did not run.");
    } finally {
      setRunning(false);
    }
  };

  const sweep = result && bars.length ? sweepSharpe(bars, spec, (next, fast) => ({
    ...next,
    entry: { ...next.entry, conditions: next.entry.conditions.map((condition, index) => index === 0 ? { ...condition, left: { ...condition.left, period: fast } } : condition) },
  }), [10, 20, 50], null, 10) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} aria-label="Symbol" className="h-10 w-28 rounded-md border border-border bg-card px-2 font-mono" />
        {PRESETS.map((preset) => (
          <button key={preset.name} type="button" className="h-10 rounded-full px-3 text-xs" onClick={() => void runBacktest(preset.spec)}>
            {preset.name}
          </button>
        ))}
        <button type="button" className="h-10 rounded-full bg-foreground px-3 text-xs text-background" onClick={() => void runBacktest()}>{running ? "Running" : "Run"}</button>
        <button
          type="button"
          className="h-10 rounded-full px-3 text-xs"
          onClick={() => {
            const raw = window.location.hash.replace(/^#s=/, "");
            const decoded = decodeStrategy(raw);
            if (decoded) void runBacktest(decoded);
          }}
        >
          Open link
        </button>
      </div>
      <DataBadge source={source} delay="daily bars" />
      <p className="text-xs text-muted-foreground">Fills are the next bar's open, so the signal bar's close is not tradable. Costs use the spread estimate in basis points. Session trials for the deflated Sharpe: {trials}.</p>
      {error ? <p className="rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">{error}</p> : null}
      {result && result.stats.trades < 30 ? <p className="rounded-xl border border-gold/40 px-4 py-3 text-sm">Fewer than 30 trades. The ratios are descriptive, not evidence of an edge.</p> : null}
      {result ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Total return" value={pct(result.stats.totalReturn)} />
            <Stat label="CAGR" value={pct(result.stats.cagr)} />
            <Stat label="Sharpe" value={formatDigits(result.stats.sharpe, 2)} />
            <Stat label="Sortino" value={formatDigits(result.stats.sortino, 2)} />
            <Stat label="Calmar" value={formatDigits(result.stats.calmar, 2)} />
            <Stat label="Max drawdown" value={pct(result.stats.maxDrawdown)} />
            <Stat label="Win rate" value={`${formatDigits((result.stats.winRate * 100), 1)}%`} />
            <Stat label="Wilson 95%" value={`${formatDigits((result.wilson.lo * 100), 0)}–${formatDigits((result.wilson.hi * 100), 0)}%`} />
            <Stat label="Profit factor" value={Number.isFinite(result.stats.profitFactor) ? formatDigits(result.stats.profitFactor, 2) : "n/a"} />
            <Stat label="Buy and hold" value={pct(result.stats.buyHold)} />
            <Stat label="Deflated Sharpe" value={formatDigits(result.dsr, 2)} />
            <Stat label="Walk-forward folds" value={String(result.folds)} />
          </div>
          <div className="flex h-32 items-end gap-px">
            {result.run.equity.filter((_, index) => index % Math.ceil(result.run.equity.length / 80) === 0).map((value, index) => {
              const max = Math.max(...result.run.equity);
              const min = Math.min(...result.run.equity);
              const height = max === min ? 50 : ((value - min) / (max - min)) * 100;
              return <div key={index} className="flex-1 bg-gold/80" style={{ height: `${height}%` }} />;
            })}
          </div>
          {sweep ? <p className="text-xs text-muted-foreground">Sweep trials = {countTrials([10, 20, 50], null)}. Sharpe by fast length: {sweep.cells.map((cell) => `${cell.a}:${formatDigits(cell.sharpe, 2)}`).join("  ")}</p> : null}
          <button
            type="button"
            className="h-8 self-start rounded-full px-3 text-xs"
            onClick={() => {
              const header = "side,entry,exit,pnl,reason";
              const lines = result.run.trades.map((trade) => [trade.side, trade.entry, trade.exit, trade.pnl, trade.reason].join(","));
              const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${symbol}-trades.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export trades
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Run a preset to load daily bars and replay the rules.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatDigits((value * 100), 1)}%`;
}
