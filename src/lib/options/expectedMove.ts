import type { ChainContract } from "@/lib/sources/cboe";

function mid(contract: ChainContract | undefined): number {
  if (!contract) return 0;
  if (contract.bid > 0 && contract.ask > 0) return (contract.bid + contract.ask) / 2;
  return contract.last;
}

export interface ExpectedMove {
  expiry: string;
  strike: number;
  dollars: number;
  percent: number;
}

/** ATM straddle mid divided by spot. */
export function expectedMove(contracts: ChainContract[], spot: number, expiry: string): ExpectedMove | null {
  const listed = contracts.filter((contract) => contract.expiry === expiry);
  const strikes = [...new Set(listed.map((contract) => contract.strike))];
  if (strikes.length === 0 || spot <= 0) return null;
  const strike = strikes.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0];
  const call = listed.find((contract) => contract.right === "call" && contract.strike === strike);
  const put = listed.find((contract) => contract.right === "put" && contract.strike === strike);
  const dollars = mid(call) + mid(put);
  return { expiry, strike, dollars, percent: dollars / spot };
}
