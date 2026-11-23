"use client";

import { useEffect, useState } from "react";
import { formatAge } from "@/lib/format";
import { isStale, parseAsOf, type FreshnessKind } from "@/lib/market/freshness";
import { usEquitySession } from "@/lib/market/session";

export function DataBadge({
  source,
  asOf,
  delay,
  inferred,
  inferredReason,
  unavailable,
  stale,
  kind = "daily",
  coverage,
}: {
  source: string;
  asOf?: string | null;
  delay?: string | null;
  inferred?: boolean;
  inferredReason?: string;
  unavailable?: boolean;
  stale?: boolean;
  kind?: FreshnessKind;
  coverage?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const asOfMs = parseAsOf(asOf);
  const age = asOfMs ? formatAge(asOfMs, now) : null;
  const session = usEquitySession(new Date(now));
  const staleNow = stale || (asOfMs != null && isStale(asOfMs, kind, now));
  const partial = coverage != null && coverage < 1;
  const stamp = asOfMs
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(asOfMs)) + " ET"
    : asOf ?? null;
  const parts = [
    unavailable ? "Unavailable" : source,
    stamp ? `as of ${stamp}${age ? ` (${age})` : ""}` : null,
    delay,
    session.status === "closed" ? "market closed" : null,
  ].filter(Boolean);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
      <span>{parts.join(" · ")}</span>
      {partial ? <span className="text-gold">· partial coverage</span> : null}
      {staleNow ? <span className="text-gold">· stale</span> : null}
      {inferred ? (
        <span className="text-gold" title={inferredReason ?? "This value is estimated, not observed."}>
          · inferred
        </span>
      ) : null}
    </p>
  );
}
