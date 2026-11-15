import { normalCdf } from "@/lib/stats/normal";

export interface StrategyLeg {
  right: "call" | "put";
  side: 1 | -1;
  strike: number;
  premium: number;
  quantity: number;
}

export interface StrategyPoint {
  spot: number;
  pnl: number;
}

export function legPayoff(leg: StrategyLeg, spot: number): number {
  const intrinsic = leg.right === "call" ? Math.max(0, spot - leg.strike) : Math.max(0, leg.strike - spot);
  return leg.side * leg.quantity * (intrinsic - leg.premium) * 100;
}

export function strategyCurve(legs: StrategyLeg[], spots: number[]): StrategyPoint[] {
  return spots.map((spot) => ({
    spot,
    pnl: legs.reduce((sum, leg) => sum + legPayoff(leg, spot), 0),
  }));
}

export function breakevens(curve: StrategyPoint[]): number[] {
  const points: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const left = curve[i - 1];
    const right = curve[i];
    if (left.pnl === 0) points.push(left.spot);
    else if (left.pnl * right.pnl < 0) {
      const weight = Math.abs(left.pnl) / (Math.abs(left.pnl) + Math.abs(right.pnl));
      points.push(left.spot + (right.spot - left.spot) * weight);
    }
  }
  return points;
}

/** Risk-neutral chance the terminal spot lands where P/L is positive. Rate is zero. */
export function probabilityOfProfit(curve: StrategyPoint[], spot: number, sigma: number, timeYears: number): number | null {
  if (sigma <= 0 || timeYears <= 0 || spot <= 0) return null;
  const width = curve.length > 1 ? curve[1].spot - curve[0].spot : 1;
  let probability = 0;
  for (const point of curve) {
    if (point.pnl <= 0) continue;
    const z = (Math.log(point.spot / spot) + 0.5 * sigma * sigma * timeYears) / (sigma * Math.sqrt(timeYears));
    const density = Math.exp(-0.5 * z * z) / (point.spot * sigma * Math.sqrt(timeYears) * Math.sqrt(2 * Math.PI));
    probability += density * width;
  }
  return Math.min(1, Math.max(0, probability));
}

export function callDeltaCheck(spot: number, strike: number, sigma: number, timeYears: number): number {
  const d2 = (Math.log(spot / strike) - 0.5 * sigma * sigma * timeYears) / (sigma * Math.sqrt(timeYears));
  return normalCdf(d2);
}
