"use client";
import { formatDigits } from "@/lib/format";

import { StatusPill } from "@/components/live/status-pill";
import { TideLines } from "@/components/live/tide-lines";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { ETFS, cumulativeTide, sectorTide } from "@/lib/flow/tape";

function money(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${formatDigits((Math.abs(value) / 1e6), 2)}M`;
}

export function TideBoard() {
  const feed = useWorkerFeed();
  const market = cumulativeTide(feed.prints);
  const sectors = sectorTide(feed.prints);
  const etf = cumulativeTide(feed.prints.filter((print) => ETFS.has(print.root)));
  const max = Math.max(1, ...sectors.map((row) => Math.abs(row.net)));

  return (
    <div className="flex flex-col gap-4">
      <StatusPill status={feed.status} replay={feed.replay} />
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
      <section>
        <h2 className="text-sm font-medium">Market tide</h2>
        <p className="text-[11px] text-muted-foreground">Green is cumulative net call premium. Red is cumulative net put premium. Gold is call minus put. Mid prints under $1,000 and deep in-the-money contracts are excluded.</p>
        <TideLines points={market} />
      </section>
      <section>
        <h2 className="text-sm font-medium">ETF tide</h2>
        <TideLines points={etf} />
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
