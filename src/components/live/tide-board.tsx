"use client";
import { formatDigits } from "@/lib/format";

import { StatusPill } from "@/components/live/status-pill";
import { TideChart } from "@/components/live/tide-chart";
import { sessionSlice } from "@/lib/options/heat";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { ETFS, cumulativeTide, sectorTide } from "@/lib/flow/tape";

function money(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${formatDigits((Math.abs(value) / 1e6), 2)}M`;
}

export function TideBoard() {
  const feed = useWorkerFeed();
  // One session only: the worker buffer can hold the tail of the prior day.
  const session = sessionSlice([...feed.prints].sort((a, b) => (a.time < b.time ? -1 : 1)));
  const market = cumulativeTide(session);
  const sectors = sectorTide(session);
  const etf = cumulativeTide(session.filter((print) => ETFS.has(print.root)));
  const last = market.at(-1);
  const max = Math.max(1, ...sectors.map((row) => Math.abs(row.net)));

  return (
    <div className="flex flex-col gap-4">
      <StatusPill status={feed.status} replay={feed.replay} />
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
      {last ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { label: "Net call premium", value: money(last.call), tone: last.call >= 0 ? "text-bullish" : "text-bearish" },
            { label: "Net put premium", value: money(last.put), tone: last.put >= 0 ? "text-bearish" : "text-bullish" },
            { label: "Call minus put", value: money(last.net), tone: last.net >= 0 ? "text-bullish" : "text-bearish" },
            { label: "Tide reads", value: last.net >= 0 ? "Bullish lean" : "Bearish lean", tone: last.net >= 0 ? "text-bullish" : "text-bearish" },
          ].map((card) => (
            <div key={card.label} className="surface px-4 py-3">
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
              <p className={`mt-1 font-mono text-lg ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <section>
        <h2 className="text-sm font-semibold">Market tide, intraday</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">Cumulative net call premium (green), net put premium (red), and call minus put (gold) through the session, in ET. Net premium is ask-side minus bid-side. Mid prints under $1,000 and deep in-the-money contracts are excluded.</p>
        <TideChart points={market} label="All polled names" />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">ETF tide</h2>
        <TideChart points={etf} label="ETFs only" />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium">Sector and top net impact</h2>
        <ul className="flex flex-col gap-1">
          {sectors.map((row) => (
            <li key={row.name} className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2 text-xs">
              <span>{row.name}</span>
              <span className="h-2 rounded-full bg-foreground/10">
                <span className={`block h-2 rounded-full ${row.net >= 0 ? "bg-bullish" : "bg-bearish"}`} style={{ width: `${(Math.abs(row.net) / max) * 100}%` }} />
              </span>
              <span className="text-right font-mono">{money(row.net)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
