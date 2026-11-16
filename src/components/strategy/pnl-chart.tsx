"use client";

import { useEffect, useRef } from "react";
import { ColorType, LineSeries, createChart, type UTCTimestamp } from "lightweight-charts";
import { bookValue, type StockHedge, type StrategyLeg } from "@/lib/options/strategy";

export function PnlChart({ legs, hedge, spot, asOf, ivShift }: { legs: StrategyLeg[]; hedge: StockHedge | null; spot: number; asOf: Date; ivShift: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current || !legs.length || !(spot > 0)) return;
    const expiries = legs.map((leg) => Date.parse(`${leg.expiry ?? asOf.toISOString().slice(0, 10)}T21:00:00Z`)).filter(Number.isFinite);
    const expiry = new Date(Math.max(asOf.getTime(), ...expiries));
    const span = Math.max(0, expiry.getTime() - asOf.getTime());
    const marks = [asOf, new Date(asOf.getTime() + span / 3), new Date(asOf.getTime() + (2 * span) / 3), expiry];
    const chart = createChart(host.current, {
      autoSize: true,
      height: 280,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#c4c4c4", attributionLogo: true },
      grid: { vertLines: { color: "rgba(255,255,255,0.05)" }, horzLines: { color: "rgba(255,255,255,0.05)" } },
    });
    const colors = ["oklch(0.84 0.12 88)", "oklch(0.78 0.08 250)", "oklch(0.8 0.15 155)", "#d6d6d6"];
    marks.forEach((date, seriesIndex) => {
      const series = chart.addSeries(LineSeries, { color: colors[seriesIndex], lineWidth: 2 });
      series.setData(Array.from({ length: 61 }, (_, index) => {
        const price = spot * (0.7 + (0.6 * index) / 60);
        return { time: index as UTCTimestamp, value: bookValue(legs, hedge, price, date, ivShift) };
      }));
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [legs, hedge, spot, asOf, ivShift]);
  return <div ref={host} className="h-72 w-full" />;
}
