"use client";

import Link from "next/link";
import { DataBadge } from "@/components/data-badge";
import { workerConnected, workerUrl } from "@/lib/live/worker";

export function OfflinePanel({
  title,
  detail,
  delayed,
}: {
  title: string;
  detail: string;
  delayed?: { href: string; label: string };
}) {
  const connected = workerConnected();
  return (
    <div className="flex flex-col gap-3">
      <DataBadge source={connected ? "TradeHax worker" : "No worker"} delay="about 15 min" inferred inferredReason="Interval prints are the change in Cboe volume between snapshots, not a single order." unavailable={!connected} />
      <p className="text-sm">{connected ? `Worker ${workerUrl()} is configured. Open it for the latest poll.` : "Live feed not connected."}</p>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{detail}</p>
      {delayed ? (
        <Link className="text-sm text-gold underline-offset-2 hover:underline" href={delayed.href}>
          {delayed.label}
        </Link>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}
