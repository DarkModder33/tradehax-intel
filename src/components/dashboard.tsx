"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { describeAgreement, rankSignals } from "@/lib/indicators/agreement";
import { FACTOR_LABEL, FACTOR_WEIGHTS, TIMEFRAME_LABEL, TIMEFRAMES, type Timeframe } from "@/lib/indicators";
import { NEUTRAL_NET, SCORE_BLEND } from "@/lib/indicators/score";
import { formatAge, formatEt } from "@/lib/format";
import { usEquitySession } from "@/lib/market/session";
import { MAX_SYMBOLS, sanitizeSymbols } from "@/lib/market/symbols";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefing } from "@/components/briefing";
import { SignalCard } from "@/components/signal-card";
import { TimeframeBoard } from "@/components/timeframe-board";
import { useDashboard } from "@/components/use-dashboard";
import { useWatchlist } from "@/components/use-watchlist";
import { Watchlist, type WatchHint } from "@/components/watchlist";
import { cn } from "@/lib/utils";

type BoardView = Timeframe | "board";

export function Dashboard() {
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
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em]">TRADEHAX</p>
              <h1 className="text-xs text-muted-foreground">Market intelligence</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data ? (
              <Badge variant="outline" className={cn(data.source.kind === "demo" && "border-gold/50 text-gold")}>
                {data.source.kind === "demo" ? "Demo data" : "Yahoo Finance"}
              </Badge>
            ) : null}
            {session ? (
              <span className="text-xs text-muted-foreground">{session.label}</span>
            ) : null}
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {refreshing ? "Updating" : data && now ? `Synced ${formatAge(data.updatedAt, now)}` : "Loading"}
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh signals" onClick={reload} disabled={symbols.length === 0}>
              <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-4 md:grid-cols-[280px_minmax(0,1fr)] md:px-6 md:py-6">
        <aside className="md:sticky md:top-[4.5rem] md:h-[calc(100dvh-5.5rem)]">
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
                <p className="text-[11px] tracking-[0.18em] text-gold uppercase">Desk</p>
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {view === "board" ? "Where the timeframes agree" : `Ranked on the ${TIMEFRAME_LABEL[view]}`}
                </h2>
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
            <p className="text-xs leading-relaxed text-muted-foreground">{data.source.disclaimer}</p>
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
            TradeHax is a research desk, not a broker and not investment advice. A high confidence score means the indicators agree. It does not mean a trade will work.
          </p>
        </main>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="oklch(0.84 0.12 88 / 0.16)" />
      <path d="M9 23 L16 8.5 L23 23" fill="none" stroke="oklch(0.84 0.12 88)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12.2 17.6 H19.8" stroke="oklch(0.84 0.12 88)" strokeWidth="1.8" />
    </svg>
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
