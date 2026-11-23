"use client";

import { formatCompact } from "@/lib/format";
import { heatAlpha, heatGrid, heatKey, shortGex, type HeatInput } from "@/lib/options/heat";
import { cn } from "@/lib/utils";

function label(expiry: string) {
  const date = new Date(`${expiry}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? expiry : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function GexHeatmap({ cells, spot, flip, callWall, putWall }: { cells: HeatInput[]; spot: number; flip: number | null; callWall: number | null; putWall: number | null }) {
  const grid = heatGrid(cells, spot);
  if (grid.strikes.length === 0 || grid.expiries.length === 0) {
    return <p className="text-sm text-muted-foreground">The chain has no open-interest gamma near spot.</p>;
  }
  const flipStrike = flip != null ? grid.strikes.reduce((best, strike) => (Math.abs(strike - flip) < Math.abs(best - flip) ? strike : best), grid.strikes[0]) : null;
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[11px]">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-[#11151e] px-2 py-2 text-left">Strike</th>
            {grid.expiries.map((expiry) => (
              <th key={expiry} scope="col" className="px-1 py-2 text-center">{label(expiry)}</th>
            ))}
            <th scope="col" className="px-2 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {grid.strikes.map((strike) => {
            const total = grid.totals.get(String(strike)) ?? 0;
            const marks = [
              strike === grid.spotStrike ? "Spot" : null,
              strike === flipStrike ? "Flip" : null,
              strike === callWall ? "Call wall" : null,
              strike === putWall ? "Put wall" : null,
            ].filter(Boolean);
            return (
              <tr key={strike} className={cn(strike === grid.spotStrike && "outline outline-1 -outline-offset-1 outline-gold/70")}>
                <td className="sticky left-0 z-10 bg-[#11151e] px-2 py-1 font-mono whitespace-nowrap">
                  {strike}
                  {marks.length ? <span className="ml-1.5 rounded bg-gold/15 px-1 text-[9px] text-gold">{marks.join(" · ")}</span> : null}
                </td>
                {grid.expiries.map((expiry) => {
                  const value = grid.values.get(heatKey(expiry, strike)) ?? 0;
                  const alpha = heatAlpha(value, grid.max);
                  return (
                    <td
                      key={expiry}
                      title={`${strike} ${expiry}: ${formatCompact(value)} net gamma per 1%`}
                      className="px-1 py-1 text-center font-mono tabular-nums"
                      style={{ background: value === 0 ? "transparent" : value > 0 ? `rgba(97, 218, 146, ${alpha})` : `rgba(249, 118, 118, ${alpha})`, color: alpha > 0.55 ? "#0b0e14" : undefined }}
                    >
                      {shortGex(value)}
                    </td>
                  );
                })}
                <td className={cn("px-2 py-1 text-right font-mono", total >= 0 ? "text-bullish" : "text-bearish")}>{shortGex(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[rgba(97,218,146,0.8)]" /> Dealer long gamma (dampens moves)</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[rgba(249,118,118,0.8)]" /> Dealer short gamma (amplifies moves)</span>
        <span>Net gamma per 1% move, naive sign: calls long, puts short. Color uses a square-root scale.</span>
      </div>
    </div>
  );
}
