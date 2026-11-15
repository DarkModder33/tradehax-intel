"use client";

import { StatusPill } from "@/components/live/status-pill";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { cumulativeTide } from "@/lib/flow/tape";

export function IntervalBoard() {
  const feed = useWorkerFeed();
  const buckets = cumulativeTide(feed.prints, 5 * 60_000);
  const max = Math.max(1, ...buckets.map((point) => Math.abs(point.net)));
  return (
    <div className="flex flex-col gap-3">
      <StatusPill status={feed.status} replay={feed.replay} />
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
      <p className="text-sm text-muted-foreground">Each bar is five minutes of net call premium minus net put premium. This is the interval, not one customer order.</p>
      <div className="flex h-36 items-end gap-px">
        {buckets.slice(-60).map((point) => (
          <div key={point.time} title={point.time} className={`flex-1 ${point.net >= 0 ? "bg-bullish" : "bg-bearish"}`} style={{ height: `${(Math.abs(point.net) / max) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}
