export function StatusPill({ status, replay }: { status: "live" | "delayed 15m" | "offline"; replay: boolean }) {
  const dot = status === "live" ? "bg-bullish" : status === "offline" ? "bg-bearish" : "bg-gold";
  return (
    <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 text-foreground/80">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {status}
      </span>
      {replay ? <span>Last session replay. The cash session is closed, so these prints are from the last tape.</span> : null}
    </p>
  );
}
