import type { ChainContract } from "@/lib/sources/cboe";

export function maxPain(contracts: ChainContract[]): number | null {
  const strikes = [...new Set(contracts.map((contract) => contract.strike))].sort((a, b) => a - b);
  if (strikes.length === 0) return null;
  let bestStrike = strikes[0];
  let bestPain = Number.POSITIVE_INFINITY;
  for (const price of strikes) {
    let pain = 0;
    for (const contract of contracts) {
      const intrinsic = contract.right === "call" ? Math.max(0, price - contract.strike) : Math.max(0, contract.strike - price);
      pain += contract.openInterest * intrinsic;
    }
    if (pain < bestPain) {
      bestPain = pain;
      bestStrike = price;
    }
  }
  return bestStrike;
}
