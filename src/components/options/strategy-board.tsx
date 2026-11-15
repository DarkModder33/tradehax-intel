"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { breakevens, probabilityOfProfit, strategyCurve, type StrategyLeg } from "@/lib/options/strategy";

const PRESETS: { name: string; legs: StrategyLeg[] }[] = [
  { name: "Long call", legs: [{ right: "call", side: 1, strike: 100, premium: 2, quantity: 1 }] },
  { name: "Long put", legs: [{ right: "put", side: 1, strike: 100, premium: 2, quantity: 1 }] },
  { name: "Call spread", legs: [{ right: "call", side: 1, strike: 100, premium: 3, quantity: 1 }, { right: "call", side: -1, strike: 105, premium: 1, quantity: 1 }] },
  { name: "Straddle", legs: [{ right: "call", side: 1, strike: 100, premium: 2.5, quantity: 1 }, { right: "put", side: 1, strike: 100, premium: 2.4, quantity: 1 }] },
  { name: "Iron condor", legs: [
    { right: "put", side: 1, strike: 95, premium: 1, quantity: 1 },
    { right: "put", side: -1, strike: 100, premium: 2, quantity: 1 },
    { right: "call", side: -1, strike: 105, premium: 2, quantity: 1 },
    { right: "call", side: 1, strike: 110, premium: 1, quantity: 1 },
  ] },
];

export function StrategyBoard() {
  const [legs, setLegs] = useState<StrategyLeg[]>(PRESETS[0].legs);
  const [spot, setSpot] = useState(100);
  const [sigma, setSigma] = useState(0.2);
  const curve = useMemo(() => {
    const spots = Array.from({ length: 41 }, (_, index) => spot * (0.8 + index * 0.01));
    return strategyCurve(legs, spots);
  }, [legs, spot]);
  const stops = breakevens(curve);
  const pop = probabilityOfProfit(curve, spot, sigma, 30 / 365);
  const max = Math.max(...curve.map((point) => point.pnl));
  const min = Math.min(...curve.map((point) => point.pnl));
  const scale = Math.max(Math.abs(max), Math.abs(min), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button key={preset.name} type="button" size="sm" variant="outline" onClick={() => setLegs(preset.legs)}>
            {preset.name}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Spot
          <input type="number" value={spot} onChange={(event) => setSpot(Number(event.target.value))} className="mt-1 block h-8 w-full rounded-md border border-border bg-card px-2" />
        </label>
        <label className="text-sm">IV
          <input type="number" step="0.01" value={sigma} onChange={(event) => setSigma(Number(event.target.value))} className="mt-1 block h-8 w-full rounded-md border border-border bg-card px-2" />
        </label>
      </div>
      <ul className="flex flex-col gap-2">
        {legs.map((leg, index) => (
          <li key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select value={leg.right} onChange={(event) => update(index, { right: event.target.value as "call" | "put" })} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
            <select value={leg.side} onChange={(event) => update(index, { side: Number(event.target.value) as 1 | -1 })} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
              <option value={1}>Long</option>
              <option value={-1}>Short</option>
            </select>
            <input type="number" value={leg.strike} onChange={(event) => update(index, { strike: Number(event.target.value) })} className="h-8 rounded-md border border-border bg-card px-2 text-sm" aria-label="Strike" />
            <input type="number" step="0.01" value={leg.premium} onChange={(event) => update(index, { premium: Number(event.target.value) })} className="h-8 rounded-md border border-border bg-card px-2 text-sm" aria-label="Premium" />
            <input type="number" value={leg.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} className="h-8 rounded-md border border-border bg-card px-2 text-sm" aria-label="Quantity" />
          </li>
        ))}
      </ul>
      <p className="text-sm">Breakevens {stops.length ? stops.map((stop) => stop.toFixed(2)).join(", ") : "none on this grid"}. Max on the grid ${max.toFixed(0)}. Min ${min.toFixed(0)}. Chance of profit about {pop == null ? "n/a" : `${(pop * 100).toFixed(0)}%`} over 30 days.</p>
      <div className="flex h-32 items-end gap-px">
        {curve.map((point) => (
          <div key={point.spot} className={point.pnl >= 0 ? "flex-1 bg-bullish" : "flex-1 bg-bearish"} style={{ height: `${(Math.abs(point.pnl) / scale) * 100}%` }} title={`${point.spot.toFixed(2)} ${point.pnl.toFixed(0)}`} />
        ))}
      </div>
    </div>
  );

  function update(index: number, patch: Partial<StrategyLeg>) {
    setLegs(legs.map((leg, legIndex) => (legIndex === index ? { ...leg, ...patch } : leg)));
  }
}
