"use client";

import { StatusPill } from "@/components/live/status-pill";
import { useWorkerFeed } from "@/components/live/use-worker-feed";

const RULES = [
  "RepeatedHits",
  "RepeatedHitsAscendingFill",
  "RepeatedHitsDescendingFill",
  "SweepsFollowedByFloor",
  "FloorTradeSmallCap",
  "FloorTradeMidCap",
  "FloorTradeLargeCap",
  "OtmEarningsFloor",
  "LowHistoricVolumeFloor",
  "Interval-unusual",
];

export function AlertsBoard() {
  const feed = useWorkerFeed();
  return (
    <div className="flex flex-col gap-3">
      <StatusPill status={feed.status} replay={feed.replay} />
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
      <p className="text-sm text-muted-foreground">The worker currently emits RepeatedHits from prints inside 100 milliseconds. The other named rules stay quiet until the tape has floor and opening detail.</p>
      <ul className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        {RULES.map((rule) => (
          <li key={rule} className="rounded-full border border-border px-2 py-0.5">{rule}</li>
        ))}
      </ul>
      <div className="grid gap-3 md:grid-cols-2">
        {feed.alerts.slice(0, 24).map((alert) => (
          <article key={`${alert.rule}-${alert.contract}`} className="rounded-xl bg-card/80 px-3 py-2 ring-1 ring-foreground/10">
            <p className="text-[11px] tracking-wide text-gold uppercase">{alert.rule}</p>
            <p className="font-mono text-sm">{alert.contract}</p>
            <p className="text-sm">{alert.count} prints · ${Math.round(alert.premium).toLocaleString("en-US")}</p>
          </article>
        ))}
        {feed.online && feed.alerts.length === 0 ? <p className="text-sm text-muted-foreground">No repeated-hit groups in this window.</p> : null}
      </div>
    </div>
  );
}
