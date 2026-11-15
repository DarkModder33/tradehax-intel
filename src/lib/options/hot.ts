import type { ChainContract } from "@/lib/sources/cboe";

/** Dollar premium using the last trade. Volume above open interest is the snapshot unusual test. */
export function contractPremium(contract: ChainContract): number {
  return contract.volume * contract.last * 100;
}

export function hotContracts(contracts: ChainContract[], minPremium = 10_000): ChainContract[] {
  return contracts
    .filter((contract) => contract.volume > contract.openInterest && contractPremium(contract) >= minPremium)
    .sort((a, b) => contractPremium(b) - contractPremium(a));
}

export function putCallVolume(contracts: ChainContract[]): number | null {
  let calls = 0;
  let puts = 0;
  for (const contract of contracts) {
    if (contract.right === "call") calls += contract.volume;
    else puts += contract.volume;
  }
  return calls > 0 ? puts / calls : null;
}
