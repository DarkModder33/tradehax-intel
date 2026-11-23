"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { describeAgreement, rankSignals } from "@/lib/indicators/agreement";
import { FACTOR_LABEL, FACTOR_WEIGHTS, TIMEFRAME_LABEL, TIMEFRAMES, type Timeframe } from "@/lib/indicators";
import { NEUTRAL_NET, SCORE_BLEND } from "@/lib/indicators/score";
import { cellKey } from "@/lib/engine/study";
import { journalLine } from "@/lib/journal";
import { regimeNote, SYMBOL_SECTOR } from "@/lib/market/context";
import { formatDigits, formatAge, formatEt } from "@/lib/format";
import { usEquitySession } from "@/lib/market/session";
import { MAX_SYMBOLS, sanitizeSymbols } from "@/lib/market/symbols";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefing } from "@/components/briefing";
import { SignalCard } from "@/components/signal-card";
import { TimeframeBoard } from "@/components/timeframe-board";
import { PopoutView } from "@/components/popout-view";
import { SiteNav } from "@/components/site-nav";
import { useBreakaway } from "@/components/use-breakaway";
import { useDashboard } from "@/components/use-dashboard";
import { postPopout } from "@/lib/popout/channel";
import { getPopoutSnapshot } from "@/lib/popout/live-prefs";
import { useWatchlist } from "@/components/use-watchlist";
import { Watchlist, type WatchHint } from "@/components/watchlist";
import { cn } from "@/lib/utils";

type BoardView = Timeframe | "board";

export function Dashboard({ intro }: { intro?: ReactNode } = {}) {
  const [symbols, setSymbols] = useWatchlist();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>("15m");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const kick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, []);

  const symbolKey = symbols.join(",");
  const { data, error, refreshing, reload } = useDashboard(symbolKey, symbols.length > 0);
  const breakaway = useBreakaway();
  const popTimeframe: Timeframe = view === "board" ? "15m" : view;

  useEffect(() => {
    if (!data) return;
    postPopout({ type: "snapshot", sentAt: Date.now(), payload: data });
  }, [data]);

  const openPopout = (nextSymbols: string[], timeframe: Timeframe) => {
    const sound = getPopoutSnapshot().sound;
    void breakaway.open({ symbols: nextSymbols, timeframe, sound });
  };
  const session = now == null ? null : usEquitySession(new Date(now));

  const hints = useMemo(() => {
    const next: Record<string, WatchHint> = {};
    if (!data) return next;
    for (const symbol of symbols) {
      const mine = data.signals.filter((signal) => signal.symbol === symbol);
      if (view === "board") {
        const agreement = describeAgreement(mine);
        next[symbol] = {
          direction: agreement.direction,
          text: agreement.direction === "split" ? "Split" : agreement.direction === "neutral" ? "Mixed" : `${agreement.aligned}/${agreement.total}`,
        };
      } else {
        const signal = mine.find((item) => item.timeframe === view);
        next[symbol] = {
          direction: signal?.direction ?? "neutral",
          text: signal ? `${signal.probability}%` : "n/a",
        };
      }
    }
    return next;
  }, [data, symbols, view]);

  const ranked = useMemo(() => {
    if (!data || view === "board") return [];
    return rankSignals(data.signals.filter((signal) => signal.timeframe === view));
  }, [data, view]);

  const boardOrder = useMemo(() => {
    if (!data) return symbols;
    const best = new Map<string, number>();
    for (const signal of data.signals) {
      best.set(signal.symbol, Math.max(best.get(signal.symbol) ?? 0, signal.probability));
    }
    return [...symbols].sort((a, b) => (best.get(b) ?? 0) - (best.get(a) ?? 0) || a.localeCompare(b));
  }, [data, symbols]);

  const selectedSignals = data?.signals.filter((signal) => signal.symbol === selected) ?? [];
  const agreement = selected ? describeAgreement(selectedSignals) : null;
  const quote = data?.quotes.find((item) => item.symbol === selected);
  const featured = selected && view !== "board" ? ranked.find((signal) => signal.symbol === selected) : undefined;
  const rest = featured ? ranked.filter((signal) => signal.symbol !== selected) : ranked;
  const latestBar = data?.signals.reduce((max, signal) => Math.max(max, signal.asOf), 0) ?? 0;

  const addSymbol = (symbol: string) => {
    setSymbols(sanitizeSymbols([...symbols, symbol]));
    setSelected(symbol);
  };
  const removeSymbol = (symbol: string) => {
    setSymbols(symbols.filter((item) => item !== symbol));
    setSelected((current) => (current === symbol ? null : current));
  };

  return (
    <div className="min-h-dvh">
      <SiteNav />
      {intro}
      <section id="desk" aria-label="Signal desk toolbar" className="mx-auto mt-8 flex max-w-[1400px] flex-wrap items-end justify-between gap-3 px-4 md:px-6">
        <div>
          <p className="eyebrow">Signal desk</p>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Your watchlist, scored on six timeframes</h2>
        </div>
          <div className="flex flex-wrap items-center gap-2">
            {data ? (
              <Badge
                variant="outline"
                className={cn(
                  data.health.status === "demo" && "border-gold/50 text-gold",
                  data.health.status === "disagrees" && "border-bearish/50 text-bearish",
                )}
              >
                {data.health.status === "demo"
                  ? "Demo data"
                  : data.health.status === "disagrees"
                    ? "Sources differ"
                    : "Yahoo Finance"}
              </Badge>
            ) : null}
            {session ? (
              <span className="text-xs text-muted-foreground">{session.label}</span>
            ) : null}
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {refreshing ? "Updating" : data && now ? `Synced ${formatAge(data.updatedAt, now)}` : "Loading"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openPopout(selected ? [selected] : symbols.slice(0, 4), popTimeframe)}
              disabled={symbols.length === 0}
            >
              Pop out
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh signals" onClick={reload} disabled={symbols.length === 0}>
              <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            </Button>
          </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-4 md:grid-cols-[280px_minmax(0,1fr)] md:px-6 md:py-6">
        <aside className="min-w-0 md:sticky md:top-[4.5rem] md:h-[calc(100dvh-5.5rem)]">
          <Watchlist
            symbols={symbols}
            quotes={data?.quotes ?? []}
            errors={data?.errors ?? []}
            hints={hints}
            selected={selected}
            onSelect={setSelected}
            onAdd={addSymbol}
            onRemove={removeSymbol}
          />
        </aside>

        <main className="flex min-w-0 flex-col gap-4 pb-16">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  {view === "board" ? "Where the timeframes agree" : `Ranked on the ${TIMEFRAME_LABEL[view]}`}
                </h3>
              </div>
              {latestBar ? (
                <p className="text-xs text-muted-foreground">Last bar {formatEt(latestBar)}</p>
              ) : null}
            </div>
            <div role="group" aria-label="Timeframe" className="flex gap-1 overflow-x-auto pb-1">
              {TIMEFRAMES.map((timeframe) => (
                <Button
                  key={timeframe}
                  type="button"
                  size="sm"
                  variant={view === timeframe ? "default" : "outline"}
                  aria-pressed={view === timeframe}
                  onClick={() => setView(timeframe)}
                >
                  {TIMEFRAME_LABEL[timeframe]}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={view === "board" ? "default" : "outline"}
                aria-pressed={view === "board"}
                className="ml-1"
                onClick={() => setView("board")}
              >
                Side by side
              </Button>
            </div>
          </div>

          {data?.source.kind === "demo" ? (
            <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
              <p className="font-medium text-gold">Demo data</p>
              <p className="mt-1 text-foreground/90">{data.source.disclaimer}</p>
            </div>
          ) : data ? (
            <DataHealthPanel data={data} />
          ) : null}

          {session?.status === "closed" && data?.source.kind === "live" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              The US cash session is closed, so these readings hold at the last completed bars until the tape moves again.
            </p>
          ) : null}

          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">
              <p>{error}</p>
              <Button type="button" size="sm" variant="outline" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : null}

          {data?.errors.length ? (
            <ul className="text-xs text-muted-foreground">
              {data.errors.map((item) => (
                <li key={item.symbol}>{item.message}</li>
              ))}
            </ul>
          ) : null}

          {symbols.length === 0 ? (
            <EmptyWatchlist />
          ) : !data && !error ? (
            <LoadingBoard />
          ) : data && selected && agreement ? (
            <Briefing
              symbol={selected}
              quote={quote}
              agreement={agreement}
              signals={selectedSignals}
              active={view}
              onTimeframe={setView}
              onClear={() => setSelected(null)}
              headlines={data.headlines.find((item) => item.symbol === selected)}
            />
          ) : (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {view === "board"
                ? "Each name shows all six timeframes. Open one to read why the call fired."
                : `Names are ranked by model confidence on the ${TIMEFRAME_LABEL[view]}. The percentage is how strongly these indicators agree, not a historical win rate.`}
            </p>
          )}

          {data && symbols.length > 0 && view !== "board" ? (
            <div className="flex flex-col gap-4">
              {featured ? (
                <SignalCard
                  signal={featured}
                  quote={data.quotes.find((item) => item.symbol === featured.symbol)}
                  peers={data.signals.filter((item) => item.symbol === featured.symbol)}
                  selected
                  onSelect={() => setSelected(featured.symbol)}
                  history={historyFor(data, featured)}
                  significant={featured.direction !== "neutral" && Boolean(data.cells[cellKey(featured.symbol, featured.timeframe, featured.direction)]?.significant)}
                  extras={data.notes[`${featured.symbol}|${featured.timeframe}`] ?? null}
                  regimeNote={noteFor(data, featured.direction, featured.symbol)}
                  onPopOut={() => openPopout([featured.symbol], featured.timeframe)}
                />
              ) : null}
              {rest.length > 0 ? (
                <>
                  {featured ? (
                    <h3 className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                      Also on this timeframe
                    </h3>
                  ) : null}
                  <div className="grid gap-4 xl:grid-cols-2">
                    {rest.map((signal) => (
                      <SignalCard
                        key={`${signal.symbol}-${signal.timeframe}`}
                        signal={signal}
                        quote={data.quotes.find((item) => item.symbol === signal.symbol)}
                        peers={data.signals.filter((item) => item.symbol === signal.symbol)}
                        selected={selected === signal.symbol}
                        onSelect={() => setSelected(signal.symbol)}
                        history={historyFor(data, signal)}
                        significant={signal.direction !== "neutral" && Boolean(data.cells[cellKey(signal.symbol, signal.timeframe, signal.direction)]?.significant)}
                        extras={data.notes[`${signal.symbol}|${signal.timeframe}`] ?? null}
                        regimeNote={noteFor(data, signal.direction, signal.symbol)}
                        onPopOut={() => openPopout([signal.symbol], signal.timeframe)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {data && symbols.length > 0 && view === "board" ? (
            <TimeframeBoard
              symbols={boardOrder}
              signals={data.signals}
              selected={selected}
              onSelect={setSelected}
              onOpen={(symbol, timeframe) => {
                setSelected(symbol);
                setView(timeframe);
              }}
            />
          ) : null}

          <ScoreLegend />
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Statistical signals, not financial advice. Hit rates are computed in this browser from the loaded bars, with a Wilson interval and shrinkage. They are not a promise from any paper, and this is not high-frequency trading.
          </p>
        </main>
      </div>
      {breakaway.pipWindow
        ? createPortal(<PopoutView />, breakaway.pipWindow.document.body)
        : null}
    </div>
  );
}

function historyFor(data: NonNullable<ReturnType<typeof useDashboard>["data"]>, signal: { symbol: string; timeframe: Timeframe; direction: "bullish" | "bearish" | "neutral" }): string {
  if (signal.direction === "neutral") return "Mixed readings are left out of the hit rate.";
  return data.cells[cellKey(signal.symbol, signal.timeframe, signal.direction)]?.label ?? "History has not been measured for this timeframe yet.";
}

function noteFor(
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>,
  direction: "bullish" | "bearish" | "neutral",
  symbol: string,
): string | null {
  const base = regimeNote(direction, data.context?.risk ?? null);
  const sector = SYMBOL_SECTOR[symbol];
  const row = data.context?.sectors.find((item) => item.symbol === sector);
  if (!row) return base;
  const excess = `${row.excessVsSpy >= 0 ? "+" : ""}${formatDigits((row.excessVsSpy * 100), 1)}% vs SPY over 20 days`;
  const sectorLine = `${row.name} is ${excess}.`;
  return base ? `${base} ${sectorLine}` : sectorLine;
}

function DataHealthPanel({ data }: { data: NonNullable<ReturnType<typeof useDashboard>["data"]> }) {
  const context = data.context;
  const leaders = context?.sectors.slice(0, 2) ?? [];
  const laggard = context?.sectors.at(-1);
  return (
    <section className="rounded-2xl bg-card/70 px-4 py-3 text-sm leading-relaxed ring-1 ring-foreground/10">
      <p>
        <span className="font-medium">{data.health.primaryLabel}.</span>{" "}
        <span className={data.health.status === "disagrees" ? "text-bearish" : "text-muted-foreground"}>
          {data.health.detail}
        </span>
      </p>
      <p className="mt-1 text-muted-foreground">{data.source.disclaimer}</p>
      <p className="mt-1 text-muted-foreground">{journalLine(data.journal)}</p>
      {context ? (
        <p className="mt-2">{context.riskDetail}</p>
      ) : data.source.kind === "live" ? (
        <p className="mt-2 text-muted-foreground">Market regime did not load.</p>
      ) : null}
      {leaders.length > 0 ? (
        <p className="mt-1 text-muted-foreground">
          Strongest vs SPY: {leaders.map((item) => `${item.name} ${formatDigits((item.excessVsSpy * 100), 1)}%`).join(", ")}
          {laggard ? `. Softest: ${laggard.name} ${formatDigits((laggard.excessVsSpy * 100), 1)}%` : ""}.
        </p>
      ) : null}
      {context && context.crypto.length > 0 ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {context.crypto
            .map((coin) => {
              const change = coin.change24h == null ? "" : ` ${coin.change24h >= 0 ? "+" : ""}${formatDigits(coin.change24h, 1)}% 24h`;
              return `${coin.label} $${coin.usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}${change}`;
            })
            .join(" · ")}
          <span> · CoinGecko</span>
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">{context?.earnings.detail ?? "Earnings dates: not checked."}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Track record: {data.track.trials} configurations tried. Deflated Sharpe probability {formatDigits(data.track.deflatedSharpe, 2)}. Logistic combiner {data.track.adopted ? "adopted" : "not adopted"}. {data.track.reason}
        {data.track.modelLogLoss != null && data.track.baseLogLoss != null && data.track.legacyLogLoss != null
          ? ` Out-of-sample log-loss ${formatDigits(data.track.modelLogLoss, 3)} versus base ${formatDigits(data.track.baseLogLoss, 3)} and legacy ${formatDigits(data.track.legacyLogLoss, 3)}.`
          : ""}
      </p>
    </section>
  );
}

function LoadingBoard() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <p className="sr-only">Reading price history.</p>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-80 rounded-xl" />
      ))}
    </div>
  );
}

function EmptyWatchlist() {
  return (
    <div className="rounded-2xl bg-card/80 px-5 py-8 ring-1 ring-foreground/10">
      <h2 className="text-lg font-semibold">The watchlist is empty</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Add a ticker to start a briefing. The desk holds up to {MAX_SYMBOLS} names. SPY, QQQ, and NVDA are a reasonable place to begin.
      </p>
    </div>
  );
}

function ScoreLegend() {
  const weights = (Object.keys(FACTOR_WEIGHTS) as Array<keyof typeof FACTOR_WEIGHTS>).map((id) => ({
    id,
    label: id === "macd" ? "MACD 12/26/9" : id === "rsi" ? "RSI 14" : id === "volume" ? "Volume vs the last 20 bars" : FACTOR_LABEL[id],
    weight: FACTOR_WEIGHTS[id],
  }));
  return (
    <details className="rounded-2xl bg-card/60 px-4 py-3 ring-1 ring-foreground/10">
      <summary className="cursor-pointer text-sm font-medium">How the confidence score works</summary>
      <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Five standard indicators each cast a fixed share of the vote:</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {weights.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 rounded-lg bg-foreground/5 px-3 py-1.5 font-mono text-xs text-foreground/90">
              <span>{item.label}</span>
              <span>{Math.round(item.weight * 100)}%</span>
            </li>
          ))}
        </ul>
        <p>
          Each one votes bullish, bearish, or neutral. Confidence is {Math.round(SCORE_BLEND.strength * 100)}% the strength of that weighted vote and {Math.round(SCORE_BLEND.agreement * 100)}% how many of the votes agree, then reduced when some indicators sit out. One loud reading cannot look like a full agreement.
        </p>
        <p>
          If the weighted vote is within {NEUTRAL_NET} of zero, the timeframe is mixed. The same rules run independently on 1m, 5m, 15m, 1h, 4h, and 1D. The agreement line counts how many of those timeframes share a side. Intraday VWAP resets each US session. The daily timeframe uses a 20-session VWAP.
        </p>
      </div>
    </details>
  );
}
