import type { ChainContract } from "@/lib/sources/cboe";

export interface TermPoint {
  expiry: string;
  dte: number;
  iv: number | null;
}

export interface SmilePoint {
  strike: number;
  iv: number;
  delta: number;
}

function dte(expiry: string, asOf: Date): number {
  return (Date.parse(`${expiry}T21:00:00Z`) - asOf.getTime()) / 86_400_000;
}

export function termStructure(contracts: ChainContract[], spot: number, asOf: Date): TermPoint[] {
  const expiries = [...new Set(contracts.map((contract) => contract.expiry))].sort();
  return expiries.map((expiry) => {
    const listed = contracts.filter((contract) => contract.expiry === expiry && contract.iv > 0);
    const strikes = [...new Set(listed.map((contract) => contract.strike))];
    const strike = strikes.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0];
    const call = listed.find((contract) => contract.right === "call" && contract.strike === strike);
    const put = listed.find((contract) => contract.right === "put" && contract.strike === strike);
    const ivs = [call?.iv, put?.iv].filter((value): value is number => value != null && value > 0);
    const iv = ivs.length ? ivs.reduce((sum, value) => sum + value, 0) / ivs.length : null;
    return { expiry, dte: dte(expiry, asOf), iv };
  });
}

export function smile(contracts: ChainContract[], expiry: string): SmilePoint[] {
  return contracts
    .filter((contract) => contract.expiry === expiry && contract.iv > 0)
    .map((contract) => ({ strike: contract.strike, iv: contract.iv, delta: contract.delta }))
    .sort((a, b) => a.strike - b.strike);
}

/** 25-delta risk reversal: put IV minus call IV, using the nearest listed deltas. */
export function skew25(contracts: ChainContract[], expiry: string): number | null {
  const listed = contracts.filter((contract) => contract.expiry === expiry && contract.iv > 0);
  const put = listed
    .filter((contract) => contract.right === "put")
    .sort((a, b) => Math.abs(a.delta + 0.25) - Math.abs(b.delta + 0.25))[0];
  const call = listed
    .filter((contract) => contract.right === "call")
    .sort((a, b) => Math.abs(a.delta - 0.25) - Math.abs(b.delta - 0.25))[0];
  if (!put || !call) return null;
  return put.iv - call.iv;
}

export interface SurfaceCell {
  expiry: string;
  moneyness: number;
  iv: number;
}

export function volSurface(contracts: ChainContract[], spot: number): SurfaceCell[] {
  const buckets = [0.9, 0.95, 1, 1.05, 1.1];
  const cells: SurfaceCell[] = [];
  const expiries = [...new Set(contracts.map((contract) => contract.expiry))].sort();
  for (const expiry of expiries) {
    for (const moneyness of buckets) {
      const target = spot * moneyness;
      const near = contracts
        .filter((contract) => contract.expiry === expiry && contract.iv > 0)
        .sort((a, b) => Math.abs(a.strike - target) - Math.abs(b.strike - target))[0];
      if (near) cells.push({ expiry, moneyness, iv: near.iv });
    }
  }
  return cells;
}
