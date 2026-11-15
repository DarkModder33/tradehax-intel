"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cellKey } from "@/lib/engine/study";
import { TIMEFRAME_LABEL, TIMEFRAMES, type Direction, type Timeframe } from "@/lib/indicators/types";
import { directionClass, directionLabel, formatAge, formatChange, formatPrice } from "@/lib/format";
import { POPOUT_CHANNEL, directionMap, flippedSymbols, freshnessLabel, readPopoutMessage, regimeLabel } from "@/lib/popout/channel";
import { adoptPopoutPrefs, getPopoutSnapshot, getServerPopoutSnapshot, publishPopoutPrefs, subscribePopout } from "@/lib/popout/live-prefs";
import { POPOUT_STORAGE_KEY, readPopoutPrefs, type PopoutPrefs } from "@/lib/popout/prefs";
import { playFlipSound, primeFlipSound } from "@/lib/popout/sound";
import { normalizeSymbol } from "@/lib/market/symbols";
import { Button } from "@/components/ui/button";
import { usePopoutFeed } from "@/components/use-popout-feed";
import { cn } from "@/lib/utils";

export function PopoutView() {
  const prefs = useSyncExternalStore(subscribePopout, getPopoutSnapshot, getServerPopoutSnapshot);
  const [draft, setDraft] = useState("");
  const [flashed, setFlashed] = useState<string[]>([]);
  const previous = useRef<{ timeframe: Timeframe; directions: Record<string, Direction> } | null>(null);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== POPOUT_STORAGE_KEY || !event.newValue) return;
      adoptPopoutPrefs(readPopoutPrefs({ getItem: () => event.newValue }));
    };
    window.addEventListener("storage", onStorage);
    if (typeof BroadcastChannel === "undefined") return () => window.removeEventListener("storage", onStorage);
    const channel = new BroadcastChannel(POPOUT_CHANNEL);
    const onMessage = (event: MessageEvent) => {
      const message = readPopoutMessage(event.data);
      if (message?.type === "prefs") adoptPopoutPrefs(message.prefs);
    };
    channel.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, []);

  const feed = usePopoutFeed(prefs.symbols);
  const data = feed.data;

  useEffect(() => {
    if (!data) return;
    const directions = directionMap(data.signals, prefs.timeframe);
    const prior = previous.current;
    previous.current = { timeframe: prefs.timeframe, directions };
    if (!prior || prior.timeframe !== prefs.timeframe) return;
    const flips = flippedSymbols(prior.directions, directions);
    if (flips.length === 0) return;
    setFlashed(flips);
    if (prefs.sound) playFlipSound();
    const timer = window.setTimeout(() => setFlashed([]), 800);
    return () => window.clearTimeout(timer);
  }, [data, prefs]);

  const update = (next: PopoutPrefs) => {
    publishPopoutPrefs(next);
  };

  const addSymbol = (raw: string) => {
    const symbol = normalizeSymbol(raw);
    setDraft("");
    if (!symbol || prefs.symbols.includes(symbol)) return;
    update({ ...prefs, symbols: [...prefs.symbols, symbol].slice(0, 12) });
  };

  const regime = regimeLabel(data?.context?.risk ?? null, data?.context?.vix?.level ?? null);
  const fresh = data ? freshnessLabel(data.health.status, formatAge(data.updatedAt, feed.now)) : "Loading";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/80 bg-background/90 px-3 py-2 backdrop-blur-md">
        <p className="text-[11px] font-semibold tracking-[0.18em]">TRADEHAX</p>
        <label className="sr-only" htmlFor="popout-timeframe">
          Timeframe
        </label>
        <select
          id="popout-timeframe"
          value={prefs.timeframe}
          onChange={(event) => update({ ...prefs, timeframe: event.target.value as Timeframe })}
          className="h-7 rounded-md border border-border bg-card px-2 text-xs"
        >
          {TIMEFRAMES.map((timeframe) => (
            <option key={timeframe} value={timeframe}>
              {TIMEFRAME_LABEL[timeframe]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="xs"
          variant={prefs.sound ? "default" : "outline"}
          aria-pressed={prefs.sound}
          onClick={() => {
            const sound = !prefs.sound;
            if (sound) primeFlipSound();
            update({ ...prefs, sound });
          }}
        >
          Sound {prefs.sound ? "on" : "off"}
        </Button>
        <p className="ml-auto text-[11px] text-muted-foreground" aria-live="polite">
          {feed.refreshing ? "Updating" : fresh}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            data?.context?.risk === "risk-on" && "border-bullish/50 text-bullish",
            data?.context?.risk === "risk-off" && "border-bearish/50 text-bearish",
            data?.context?.risk !== "risk-on" && data?.context?.risk !== "risk-off" && "border-gold/50 text-gold",
          )}
          title={data?.context?.riskDetail ?? "Market regime has not loaded."}
        >
          {regime}
        </span>
        <span className="text-[11px] text-muted-foreground">{feed.following ? "Following the desk" : "Fetching in this window"}</span>
      </div>

      {feed.error ? (
        <div className="mx-3 rounded-lg border border-bearish/40 bg-bearish/10 px-3 py-2 text-sm">
          <p>{feed.error}</p>
          <Button type="button" size="xs" variant="outline" className="mt-2" onClick={feed.reload}>
            Try again
          </Button>
        </div>
      ) : null}

      <ul className="flex flex-1 flex-col gap-2 px-3 pb-3">
        {prefs.symbols.length === 0 ? (
          <li className="rounded-xl bg-card/80 px-3 py-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
            Add a ticker. This window remembers the list on this browser.
          </li>
        ) : null}
        {prefs.symbols.map((symbol) => {
          const signal = data?.signals.find((item) => item.symbol === symbol && item.timeframe === prefs.timeframe);
          const quote = data?.quotes.find((item) => item.symbol === symbol);
          const error = data?.errors.find((item) => item.symbol === symbol);
          const cell =
            signal && signal.direction !== "neutral"
              ? data?.cells[cellKey(symbol, prefs.timeframe, signal.direction)]
              : undefined;
          return (
            <li
              key={symbol}
              className={cn(
                "rounded-xl bg-card/85 px-3 py-2.5 ring-1 ring-foreground/10",
                flashed.includes(symbol) && "popout-flip",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{symbol}</p>
                  <p className="font-mono text-xs">
                    {quote ? formatPrice(quote.price) : data ? "n/a" : "…"}{" "}
                    <span className={quote?.changePercent == null ? "text-muted-foreground" : quote.changePercent >= 0 ? "text-bullish" : "text-bearish"}>
                      {formatChange(quote?.changePercent ?? null)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => update({ ...prefs, symbols: prefs.symbols.filter((item) => item !== symbol) })}
                >
                  Remove
                </button>
              </div>
              {error ? <p className="mt-1 text-xs text-bearish">{error.message}</p> : null}
              {signal ? (
                <>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className={cn("text-xs font-medium tracking-wide uppercase", directionClass(signal.direction))}>
                      {directionLabel(signal.direction)}
                    </p>
                    <p className="font-serif text-2xl leading-none">
                      {signal.probability}
                      <span className="text-sm text-muted-foreground">%</span>
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {signal.direction !== "neutral" && cell?.significant ? "Significant" : "Not significant"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/90">
                    {signal.direction === "neutral"
                      ? "Mixed readings are left out of the hit rate."
                      : cell?.label ?? "Hit rate not measured yet."}
                  </p>
                </>
              ) : data ? (
                <p className="mt-2 text-xs text-muted-foreground">No {TIMEFRAME_LABEL[prefs.timeframe]} reading yet.</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Reading price history.</p>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="sticky bottom-0 flex gap-2 border-t border-border/80 bg-background/95 px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          addSymbol(draft);
        }}
      >
        <label className="sr-only" htmlFor="popout-symbol">
          Add ticker
        </label>
        <input
          id="popout-symbol"
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          placeholder="Add ticker"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 font-mono text-xs uppercase"
        />
        <Button type="submit" size="sm" variant="outline">
          Add
        </Button>
      </form>
    </div>
  );
}
