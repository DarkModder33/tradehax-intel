"use client";
import { formatDigits } from "@/lib/format";

import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { sectorTide } from "@/lib/flow/tape";

export function MapBoard() {
  const feed = useWorkerFeed();
  const sectors = sectorTide(feed.prints);
  const max = Math.max(1, ...sectors.map((row) => Math.abs(row.net)));
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {sectors.map((row) => (
        <div
          key={row.name}
          className="rounded-xl p-3 text-sm ring-1 ring-foreground/10"
          style={{ background: row.net >= 0 ? "oklch(0.8 0.15 155 / 0.25)" : "oklch(0.72 0.16 22 / 0.25)", minHeight: 40 + (Math.abs(row.net) / max) * 80 }}
        >
          <p className="font-medium">{row.name}</p>
          <p className="font-mono text-xs">${formatDigits((row.net / 1e6), 2)}M net premium</p>
        </div>
      ))}
      {sectors.length === 0 ? <p className="text-sm text-muted-foreground">No prints yet, so the map is empty.</p> : null}
    </div>
  );
}
