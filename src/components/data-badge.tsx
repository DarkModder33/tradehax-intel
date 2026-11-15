export function DataBadge({
  source,
  asOf,
  delay,
  inferred,
  inferredReason,
  unavailable,
  stale,
}: {
  source: string;
  asOf?: string | null;
  delay?: string | null;
  inferred?: boolean;
  inferredReason?: string;
  unavailable?: boolean;
  stale?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="rounded-full border border-border px-2 py-0.5">{unavailable ? "Unavailable" : source}</span>
      {asOf ? <span className="rounded-full border border-border px-2 py-0.5">As of {asOf} ET</span> : null}
      {delay ? <span className="rounded-full border border-border px-2 py-0.5">{delay}</span> : null}
      {stale ? <span className="rounded-full border border-gold/50 px-2 py-0.5 text-gold">Stale</span> : null}
      {inferred ? (
        <span className="rounded-full border border-gold/50 px-2 py-0.5 text-gold" title={inferredReason ?? "This value is estimated, not observed."}>
          Inferred
        </span>
      ) : null}
    </p>
  );
}
