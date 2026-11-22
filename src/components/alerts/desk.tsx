"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { newHits, type AlertRule } from "@/lib/alerts/rules";
import { getLists, getLog, getRules, getServerLists, getServerLog, getServerRules, setLists, setLog, setRules, subscribeAlerts } from "@/lib/alerts/store";
import { playFlipSound, primeFlipSound } from "@/lib/popout/sound";

export function AlertDesk() {
  const feed = useWorkerFeed();
  const lists = useSyncExternalStore(subscribeAlerts, getLists, getServerLists);
  const rules = useSyncExternalStore(subscribeAlerts, getRules, getServerRules);
  const log = useSyncExternalStore(subscribeAlerts, getLog, getServerLog);
  const [sound, setSound] = useState(false);
  const [ticker, setTicker] = useState("NVDA");
  const [minPremium, setMinPremium] = useState(10000);

  useEffect(() => {
    const seen = new Set(log.map((hit) => hit.id));
    const hits = newHits(feed.prints, rules, seen, new Date());
    if (hits.length === 0) return;
    const timer = window.setTimeout(() => {
      setLog([...hits, ...getLog()].slice(0, 100));
      if (sound) playFlipSound();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const hit of hits.slice(0, 3)) new Notification("TradeHax alert", { body: hit.summary });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [feed.prints, rules, log, sound]);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="text-sm font-medium">Watchlists</h2>
        {Object.entries(lists).map(([name, symbols]) => (
          <p key={name} className="mt-1 text-sm"><span className="text-muted-foreground">{name}: </span>{symbols.join(", ")}</p>
        ))}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const symbol = ticker.trim().toUpperCase();
            if (!symbol) return;
            setLists({ ...lists, Main: [...new Set([...(lists.Main ?? []), symbol])] });
          }}
        >
          <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} className="h-8 w-28 rounded-md border border-border bg-card px-2 font-mono uppercase" aria-label="Add to watchlist" />
          <Button type="submit" size="sm" variant="outline">Add</Button>
        </form>
      </section>
      <section>
        <h2 className="text-sm font-medium">Rules</h2>
        <p className="text-xs text-muted-foreground">A rule that requires volume above open interest stays quiet unless the print carries open interest. This feed does not. Web push stays off until the worker has VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, and CF_API_TOKEN. Those values are never stored in the repo.</p>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          onClick={() => {
            const rule: AlertRule = { id: crypto.randomUUID(), ticker, minPremium, side: "any", flag: "any", maxDte: 60, otm: false, volOverOi: false };
            setRules([...rules, rule]);
          }}
        >
          Watch {ticker || "any"} above ${minPremium}
        </Button>
        <label className="mt-2 block text-xs">Minimum premium
          <input type="number" value={minPremium} onChange={(event) => setMinPremium(Number(event.target.value))} className="ml-2 h-7 w-28 rounded-md border border-border bg-card px-2" />
        </label>
        <ul className="mt-2 text-sm">
          {rules.map((rule) => <li key={rule.id}>{rule.ticker || "Any"} · ${rule.minPremium} · DTE ≤ {rule.maxDte ?? "any"}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">Notifications</h2>
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void Notification.requestPermission()}>Allow browser notifications</Button>
          <Button type="button" size="sm" variant={sound ? "default" : "outline"} onClick={() => { if (!sound) primeFlipSound(); setSound(!sound); }}>Sound {sound ? "on" : "off"}</Button>
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium">History</h2>
        <ul className="mt-1 text-sm">
          {log.slice(0, 20).map((hit) => <li key={hit.id}>{hit.summary}</li>)}
          {log.length === 0 ? <li className="text-muted-foreground">No alerts yet.</li> : null}
        </ul>
      </section>
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
    </div>
  );
}
