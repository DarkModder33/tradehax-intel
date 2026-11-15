export function StatusPill({ status, replay }: { status: "live" | "delayed 15m" | "offline"; replay: boolean }) {
  const color = status === "live" ? "border-bullish/50 text-bullish" : status === "offline" ? "border-bearish/50 text-bearish" : "border-gold/50 text-gold";
  return (
    <p className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className={`rounded-full border px-2 py-0.5 ${color}`}>{status}</span>
      {replay ? <span className="text-muted-foreground">Last session replay. The cash session is closed, so these prints are from the last tape.</span> : null}
    </p>
  );
}
