"use client";

import { StatusPill } from "@/components/live/status-pill";
import { useWorkerFeed } from "@/components/live/use-worker-feed";
import { formatEt } from "@/lib/format";
import { priceLevels } from "@/lib/flow/tape";

export function OffexBoard() {
  const feed = useWorkerFeed();
  const levels = priceLevels(feed.offex).slice(0, 12);
  const max = Math.max(1, ...levels.map((level) => level.notional));
  return (
    <div className="flex flex-col gap-4">
      <StatusPill status={feed.status} replay={feed.replay} />
      {feed.error ? <p className="text-sm text-bearish">{feed.error}</p> : null}
      <p className="text-sm text-muted-foreground">These are SIP stock prints reported to a FINRA TRF, exchange D, at least $1M, about 15 minutes delayed. They include ATS and internalized retail flow. They are not only dark pools.</p>
      <section>
        <h2 className="mb-2 text-sm font-medium">Price levels</h2>
        <ul className="flex flex-col gap-1">
          {levels.map((level) => (
            <li key={level.price} className="grid grid-cols-[5rem_1fr_6rem] items-center gap-2 text-xs">
              <span className="font-mono">{level.price.toFixed(2)}</span>
              <span className="h-2 rounded-full bg-foreground/10"><span className="block h-2 rounded-full bg-gold" style={{ width: `${(level.notional / max) * 100}%` }} /></span>
              <span className="text-right font-mono">${(level.notional / 1e6).toFixed(2)}M</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>{["Time", "Ticker", "Price", "Size", "Notional"].map((label) => <th key={label} className="px-2 py-1 text-right font-normal">{label}</th>)}</tr>
          </thead>
          <tbody>
            {feed.offex.slice(0, 80).map((print) => (
              <tr key={`${print.symbol}-${print.time}-${print.size}`} className="border-t border-border/50">
                <td className="px-2 py-1 text-right">{formatEt(Date.parse(print.time))}</td>
                <td className="px-2 py-1 text-right font-mono">{print.symbol}</td>
                <td className="px-2 py-1 text-right font-mono">{print.price.toFixed(2)}</td>
                <td className="px-2 py-1 text-right">{print.size.toLocaleString("en-US")}</td>
                <td className="px-2 py-1 text-right">${Math.round(print.notional).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
