"use client";
import { formatDigits } from "@/lib/format";

import { bookValue, type StockHedge, type StrategyLeg } from "@/lib/options/strategy";

export function PnlHeatmap({ legs, hedge, spot, asOf, ivShift }: { legs: StrategyLeg[]; hedge: StockHedge | null; spot: number; asOf: Date; ivShift: number }) {
  if (!legs.length || !(spot > 0)) return null;
  const expiries = legs.map((leg) => Date.parse(`${leg.expiry ?? asOf.toISOString().slice(0, 10)}T21:00:00Z`)).filter(Number.isFinite);
  const expiry = Math.max(asOf.getTime(), ...expiries);
  const dates = [0, 0.33, 0.66, 1].map((fraction) => new Date(asOf.getTime() + (expiry - asOf.getTime()) * fraction));
  const prices = Array.from({ length: 9 }, (_, index) => spot * (0.8 + index * 0.05));
  const cells = dates.flatMap((date) => prices.map((price) => bookValue(legs, hedge, price, date, ivShift)));
  const max = Math.max(1, ...cells.map((value) => Math.abs(value)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr>
            <th className="p-1 text-left">Price</th>
            {dates.map((date) => (
              <th key={date.toISOString()} className="p-1 text-left font-normal">{date.toISOString().slice(5, 10)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prices.map((price) => (
            <tr key={price}>
              <td className="p-1 font-mono">{formatDigits(price, 1)}</td>
              {dates.map((date) => {
                const value = bookValue(legs, hedge, price, date, ivShift);
                const alpha = Math.min(0.8, Math.abs(value) / max);
                const color = value >= 0 ? `oklch(0.8 0.15 155 / ${alpha})` : `oklch(0.72 0.16 22 / ${alpha})`;
                return (
                  <td key={date.toISOString()} className="p-1 font-mono" style={{ background: color }}>
                    {Math.round(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
