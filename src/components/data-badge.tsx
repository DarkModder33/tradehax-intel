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
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="rounded-full border border-border px-2 py-0.5">{unavailable ? "Unavailable" : source}</span>
      {asOf ? <span className="rounded-full border border-border px-2 py-0.5">As of {asOf}{age ? ` · ${age}` : ""}</span> : null}
      {delay ? <span className="rounded-full border border-border px-2 py-0.5">{delay}</span> : null}
      {session.status === "closed" ? <span className="rounded-full border border-border px-2 py-0.5">Market closed</span> : null}
      {partial ? <span className="rounded-full border border-gold/50 px-2 py-0.5 text-gold">Partial coverage</span> : null}
      {staleNow ? <span className="rounded-full border border-gold/50 px-2 py-0.5 text-gold">Stale</span> : null}
      {inferred ? (
        <span className="rounded-full border border-gold/50 px-2 py-0.5 text-gold" title={inferredReason ?? "This value is estimated, not observed."}>
          Inferred
        </span>
      ) : null}
    </p>
  );
}
