export interface NopeInput {
  right: "call" | "put";
  volume: number;
  delta: number;
}

/** (call volume × delta − put volume × |delta|) × 100 / stock volume. */
export function nope(contracts: NopeInput[], stockVolume: number): number | null {
  if (stockVolume <= 0) return null;
  let signed = 0;
  for (const contract of contracts) {
    if (contract.right === "call") signed += contract.volume * contract.delta;
    else signed -= contract.volume * Math.abs(contract.delta);
  }
  return (signed * 100) / stockVolume;
}
