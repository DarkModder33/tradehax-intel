"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ALERT_LABELS, ALERT_TYPES, alertTime, flowAlerts, type Alert, type AlertType, type PrintLike } from "@/lib/alerts/feed";
import { workerConnected, workerUrl } from "@/lib/live/worker";
import { datasetUrl } from "@/lib/sources/manifest";
import { tickerPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;

function useAlerts(ticker?: string) {
  const [stored, setStored] = useState<Alert[]>([]);
  const [live, setLive] = useState<Alert[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [liveAt, setLiveAt] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    fetch(datasetUrl("alerts.json"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { alerts?: Alert[]; meta?: { asOf?: string } }) => {
        if (stop) return;
        setStored(body.alerts ?? []);
        setAsOf(body.meta?.asOf ?? null);
        setStatus("ready");
      })
      .catch(() => !stop && setStatus("error"));
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!workerConnected()) return;
    let stop = false;
    const load = async () => {
      try {
        const query = new URLSearchParams({ minPremium: "250000", limit: "800" });
        if (ticker) query.set("symbol", ticker);
        const response = await fetch(`${workerUrl()}/v1/flow?${query}`, { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { prints?: PrintLike[] };
        if (stop) return;
        setLive(flowAlerts(body.prints ?? []));
        setLiveAt(Date.now());
        setStatus((current) => (current === "error" ? "ready" : current));
      } catch {
        // The stored feed still renders without the worker.
      }
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ticker]);

  const alerts = useMemo(() => {
    const byId = new Map<string, Alert>();
    for (const alert of [...stored, ...live]) byId.set(alert.id, alert);
    return [...byId.values()]
      .filter((alert) => !ticker || alert.ticker === ticker)
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [stored, live, ticker]);

  return { alerts, asOf, status, liveAt };
}

function Sentiment({ value }: { value: Alert["sentiment"] }) {
  return (
    <span className={cn("text-[11px] font-medium", value === "Bullish" ? "text-bullish" : value === "Bearish" ? "text-bearish" : "text-muted-foreground")}>
      {value}
    </span>
  );
}

function AlertRow({ alert, dense = false }: { alert: Alert; dense?: boolean }) {
  if (dense) {
    return (
      <li className="grid grid-cols-[3.25rem_3.5rem_minmax(0,1fr)_3.75rem] items-baseline gap-x-3 py-1.5 font-mono text-[12px] tabular-nums">
        <span className="text-muted-foreground">{alertTime(alert)}</span>
        <Link href={tickerPath(alert.ticker)} className="font-semibold hover:text-gold">{alert.ticker}</Link>
        <span className="truncate">
          <span className="font-sans text-foreground/90">{alert.label}</span> {alert.value} <span className="text-muted-foreground max-sm:hidden">{alert.detail}</span>
        </span>
        <span className="text-right"><Sentiment value={alert.sentiment} /></span>
      </li>
    );
  }
  return (
    <li className="py-2 font-mono text-[12.5px] tabular-nums">
      <div className="grid grid-cols-[3.25rem_3.75rem_minmax(0,1fr)_4rem] items-baseline gap-x-3 md:grid-cols-[3.5rem_4rem_10rem_6.5rem_minmax(0,1fr)_4.5rem]">
        <span className="text-muted-foreground">{alertTime(alert)}</span>
        <Link href={tickerPath(alert.ticker)} className="font-semibold hover:text-gold">{alert.ticker}</Link>
        <span className="truncate font-sans text-foreground/90 md:order-none">
          {alert.label}
          <span className="ml-2 font-mono text-foreground md:hidden">{alert.value}</span>
        </span>
        <span className="text-right text-foreground max-md:hidden">{alert.value}</span>
        <span className="truncate text-muted-foreground max-md:hidden">{alert.detail}</span>
        <span className="text-right"><Sentiment value={alert.sentiment} /></span>
      </div>
      <p className="mt-0.5 truncate pl-[calc(3.25rem+0.75rem)] text-[11.5px] text-muted-foreground md:hidden">{alert.detail}</p>
    </li>
  );
}

/** Compact alert list for the home page and ticker pages. */
export function AlertsStrip({ ticker, limit = 8, title = "Latest alerts" }: { ticker?: string; limit?: number; title?: string }) {
  const { alerts, status } = useAlerts(ticker);
  const rows = alerts.slice(0, limit);
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="section-title">{title}</h2>
        <Link href={ticker ? `/alerts/?t=${ticker}` : "/alerts/"} className="text-xs text-muted-foreground hover:text-foreground">
          All alerts →
        </Link>
      </div>
      <div className="surface px-3">
        {status === "loading" && !rows.length ? (
          <p className="py-3 text-xs text-muted-foreground">Loading alerts…</p>
        ) : rows.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">{ticker ? `No ${ticker} alerts in the last week.` : "No alerts in the feed yet."}</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {rows.map((alert) => (
              <AlertRow key={alert.id} alert={alert} dense />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The full /alerts/ feed with type, ticker and sentiment filters. */
export function AlertsFeed() {
  const [ticker, setTicker] = useState("");
  const [types, setTypes] = useState<Set<AlertType>>(new Set());
  const [sentiment, setSentiment] = useState<"all" | Alert["sentiment"]>("all");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("t");
    const timer = initial ? window.setTimeout(() => setTicker(initial.toUpperCase()), 0) : undefined;
    return () => window.clearTimeout(timer);
  }, []);

  const clean = ticker.trim().toUpperCase();
  const { alerts, asOf, status, liveAt } = useAlerts(/^[A-Z][A-Z0-9.]{0,9}$/.test(clean) ? clean : undefined);
  const counts = useMemo(() => {
    const out = new Map<AlertType, number>();
    for (const alert of alerts) out.set(alert.type, (out.get(alert.type) ?? 0) + 1);
    return out;
  }, [alerts]);
  const shown = alerts.filter((alert) => (types.size === 0 || types.has(alert.type)) && (sentiment === "all" || alert.sentiment === sentiment)).slice(0, 300);

  const toggle = (type: AlertType) => {
    setTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="grid gap-3">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [&>*]:shrink-0">
        <input
          value={ticker}
          onChange={(event) => setTicker(event.target.value.toUpperCase())}
          placeholder="Ticker"
          aria-label="Filter by ticker"
          className="h-8 w-28 rounded-md border border-white/[0.08] bg-transparent px-2.5 font-mono text-xs uppercase outline-none placeholder:text-muted-foreground focus:border-white/25"
        />
        <button type="button" className={cn("chip", types.size === 0 && "chip-active")} onClick={() => setTypes(new Set())}>
          All
        </button>
        {ALERT_TYPES.map((type) => (
          <button key={type} type="button" aria-pressed={types.has(type)} className={cn("chip", types.has(type) && "chip-active")} onClick={() => toggle(type)}>
            {ALERT_LABELS[type]}
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{counts.get(type) ?? 0}</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10 max-sm:hidden" />
        {(["all", "Bullish", "Bearish"] as const).map((value) => (
          <button key={value} type="button" className={cn("chip", sentiment === value && "chip-active")} onClick={() => setSentiment(value)}>
            {value === "all" ? "Any side" : value}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {shown.length} shown. Filings and daily signals as of{" "}
        {asOf ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(asOf)) + " ET" : "n/a"}
        {liveAt ? ". Tape refreshes every 30 s, about 15 min delayed." : ". Tape is offline; showing the stored feed."}
      </p>
      <div className="surface px-3">
        <div className="hidden grid-cols-[3.5rem_4rem_10rem_6.5rem_minmax(0,1fr)_4.5rem] gap-x-3 border-b border-white/[0.06] py-2 text-[11px] text-muted-foreground md:grid">
          <span>Time</span>
          <span>Ticker</span>
          <span>Alert</span>
          <span className="text-right">Value</span>
          <span>Detail</span>
          <span className="text-right">Side</span>
        </div>
        {status === "loading" && !shown.length ? (
          <p className="py-4 text-xs text-muted-foreground">Loading alerts…</p>
        ) : status === "error" && !shown.length ? (
          <p className="py-4 text-xs text-muted-foreground">The alert feed did not load. It is rebuilt with every data run.</p>
        ) : shown.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">No alerts match these filters.</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {shown.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
