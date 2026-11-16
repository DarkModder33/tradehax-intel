"use client";

import { formatPrice } from "@/lib/format";
import {
  aggregateGreeks,
  bookValue,
  expectedValue,
  marginEstimate,
  maxProfitLoss,
  probabilityOfProfit,
  strategyCurve,
  type StockHedge,
  type StrategyLeg,
} from "@/lib/options/strategy";

function money(value: number | null, unlimited: boolean, loss = false): string {
  if (unlimited) return loss ? "Unlimited" : "Unlimited";
  if (value == null) return "n/a";
  return formatPrice(value);
}

export function StrategySummary({ legs, hedge, spot, asOf, ivShift }: { legs: StrategyLeg[]; hedge: StockHedge | null; spot: number; asOf: Date; ivShift: number }) {
  const debit = legs.reduce((sum, leg) => sum + leg.side * leg.premium * leg.quantity * 100, 0);
  const bounds = maxProfitLoss(legs, hedge);
  const front = legs.map((leg) => leg.expiry).filter(Boolean).sort()[0];
  const sigma = legs.find((leg) => (leg.iv ?? 0) > 0)?.iv ?? 0.2;
  const timeYears = front ? Math.max(1 / 365, (Date.parse(`${front}T21:00:00Z`) - asOf.getTime()) / (365 * 24 * 60 * 60 * 1000)) : 30 / 365;
  const spots = Array.from({ length: 81 }, (_, index) => spot * (0.6 + (0.8 * index) / 80));
  const expiryDate = new Date(asOf.getTime() + timeYears * 365 * 24 * 60 * 60 * 1000);
  const curve = strategyCurve(
    legs.map((leg) => ({ ...leg, premium: leg.premium })),
    spots,
  ).map((point, index) => ({ spot: point.spot, pnl: bookValue(legs, hedge, spots[index], expiryDate, ivShift) }));
  const pop = probabilityOfProfit(curve, spot, Math.max(0.01, sigma + ivShift), timeYears);
  const value = expectedValue(curve, spot, Math.max(0.01, sigma + ivShift), timeYears);
  const greeks = aggregateGreeks(legs, spot, asOf, ivShift);
  const margin = marginEstimate(legs, hedge);
  const crossings: number[] = [];
  for (let index = 1; index < curve.length; index += 1) {
    const left = curve[index - 1];
    const right = curve[index];
    if (left.pnl === 0 || left.pnl * right.pnl < 0) crossings.push(right.spot);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={debit >= 0 ? "Net debit" : "Net credit"} value={formatPrice(Math.abs(debit))} />
      <Stat label="Max profit" value={money(bounds.maxProfit, bounds.unboundedProfit)} />
      <Stat label="Max loss" value={money(bounds.maxLoss, bounds.unboundedLoss, true)} />
      <Stat label="Breakevens" value={crossings.length ? crossings.map((item) => item.toFixed(2)).join(", ") : "n/a"} />
      <Stat label="POP, model, risk-neutral" value={pop == null ? "n/a" : `${(pop * 100).toFixed(1)}%`} />
      <Stat label="Expected value" value={value == null ? "n/a" : formatPrice(value)} />
      <Stat label="Delta $" value={formatPrice(greeks.delta)} />
      <Stat label="Gamma $ / 1%" value={formatPrice(greeks.gamma)} />
      <Stat label="Theta $ / day" value={formatPrice(greeks.theta)} />
      <Stat label="Vega $ / pt" value={formatPrice(greeks.vega)} />
      <Stat label={margin.label === "defined" ? "Margin, defined risk" : "Margin estimate"} value={margin.amount == null ? "estimate" : formatPrice(margin.amount)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}
