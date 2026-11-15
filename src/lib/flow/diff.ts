import type { ChainContract } from "@/lib/sources/cboe";
import { inferSide, sentiment, type FlowPrint } from "./classify.ts";

export function diffChain(previous: ChainContract[], next: ChainContract[], time: string): FlowPrint[] {
  const prior = new Map(previous.map((contract) => [contract.symbol, contract]));
  const prints: FlowPrint[] = [];
  for (const contract of next) {
    const before = prior.get(contract.symbol)?.volume ?? 0;
    const size = contract.volume - before;
    if (size <= 0) continue;
    const price = contract.last > 0 ? contract.last : contract.bid > 0 && contract.ask > 0 ? (contract.bid + contract.ask) / 2 : 0;
    const side = inferSide(price, contract.bid, contract.ask);
    prints.push({
      time,
      contract: contract.symbol,
      root: contract.root,
      expiry: contract.expiry,
      strike: contract.strike,
      right: contract.right,
      side,
      size,
      price,
      premium: size * price * 100,
      delta: contract.delta,
      conditions: [],
      inferred: true,
      sentiment: sentiment(contract.right, side),
      flags: [],
    });
  }
  return prints;
}
