"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/alerts/feed";
import { formatDigits } from "@/lib/format";
import { workerConnected, workerUrl } from "@/lib/live/worker";
import { datasetUrl } from "@/lib/sources/manifest";
import { tickerPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

function ModuleHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="section-title">{title}</h2>
      <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">{link} →</Link>
    </div>
  );
}

interface TideBody {
  tide?: { netCallPremium?: number; netPutPremium?: number };
  impact?: { symbol: string; net: number }[];
}

/** Net premium by name from the worker tape: who is being bought and sold right now. */
export function NetPremiumModule() {
  const [body, setBody] = useState<TideBody | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!workerConnected()) return;
    let stop = false;
    const load = () =>
      fetch(`${workerUrl()}/v1/tide`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((next: TideBody) => !stop && setBody(next))
        .catch(() => !stop && setFailed(true));
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);
  const rows = (body?.impact ?? []).filter((row) => row.net !== 0).slice(0, 7);
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.net)));
  const call = body?.tide?.netCallPremium;
  const put = body?.tide?.netPutPremium;
  return (
    <section>
      <ModuleHead title="Net premium leaders" href="/tide/" link="Market tide" />
      <div className="surface px-4 py-3">
        {call != null && put != null ? (
          <div className="mb-3 grid grid-cols-2 gap-3 border-b border-white/[0.05] pb-3 font-mono text-xs tabular-nums">
            <div>
              <p className="font-sans text-[11px] text-muted-foreground">Net call premium</p>
              <p className={cn("text-sm", call >= 0 ? "text-bullish" : "text-bearish")}>{money(call)}</p>
            </div>
            <div>
              <p className="font-sans text-[11px] text-muted-foreground">Net put premium</p>
              <p className={cn("text-sm", put <= 0 ? "text-bullish" : "text-bearish")}>{money(put)}</p>
            </div>
          </div>
        ) : null}
        {rows.length ? (
          <ul className="grid gap-1.5">
            {rows.map((row) => (
              <li key={row.symbol} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 font-mono text-xs tabular-nums">
                <Link href={tickerPath(row.symbol)} className="font-semibold hover:text-gold">{row.symbol}</Link>
                <span className="relative h-1.5 rounded-full bg-white/[0.04]">
                  <span className={cn("absolute inset-y-0 left-0 rounded-full", row.net >= 0 ? "bg-bullish/70" : "bg-bearish/70")} style={{ width: `${Math.max(4, (Math.abs(row.net) / max) * 100)}%` }} />
                </span>
                <span className={cn("text-right", row.net >= 0 ? "text-bullish" : "text-bearish")}>{money(row.net)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{failed ? "The worker tape is offline." : "Loading the tape…"}</p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Ask-side minus bid-side premium, polled names, about 15 min delayed.</p>
      </div>
    </section>
  );
}

interface OptionsDay {
  date: string;
  spot?: number;
  netGex?: number;
  flip?: number | null;
}

const GAMMA_NAMES = ["SPY", "QQQ", "IWM", "NVDA", "TSLA"];

/** Dealer gamma regime for the index ETFs and two single names, from the daily options history. */
export function GammaModule() {
  const [series, setSeries] = useState<Record<string, OptionsDay[]> | null>(null);
  useEffect(() => {
    fetch(datasetUrl("options-history.json"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { series?: Record<string, OptionsDay[]> }) => setSeries(body.series ?? {}))
      .catch(() => setSeries({}));
  }, []);
  const rows = GAMMA_NAMES.map((symbol) => ({ symbol, day: series?.[symbol]?.at(-1) })).filter((row) => row.day && row.day.netGex != null);
  return (
    <section>
      <ModuleHead title="Dealer gamma" href="/gex/" link="Gamma map" />
      <div className="surface px-4 py-3">
        {rows.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="pb-1.5 text-left">Name</th>
                <th className="pb-1.5 text-right">Spot</th>
                <th className="pb-1.5 text-right">Flip</th>
                <th className="pb-1.5 text-right">Net GEX</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map(({ symbol, day }) => (
                <tr key={symbol}>
                  <td className="py-1.5"><Link href={`/gex/?s=${symbol}`} className="font-semibold hover:text-gold">{symbol}</Link></td>
                  <td className="py-1.5 text-right">{day!.spot != null ? formatDigits(day!.spot, 2) : "n/a"}</td>
                  <td className="py-1.5 text-right">{day!.flip != null ? formatDigits(day!.flip, 2) : "none"}</td>
                  <td className={cn("py-1.5 text-right", (day!.netGex ?? 0) >= 0 ? "text-bullish" : "text-bearish")}>{money(day!.netGex ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted-foreground">{series ? "No gamma history yet." : "Loading…"}</p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Open-interest gamma per 1% move, last stored session. Negative means dealers chase price.</p>
      </div>
    </section>
  );
}
