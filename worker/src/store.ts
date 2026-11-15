import { diffChain } from "../../src/lib/flow/diff.ts";
import { withFlags, type FlowPrint } from "../../src/lib/flow/classify.ts";
import type { ChainContract, ChainSnapshot } from "../../src/lib/sources/cboe.ts";

/** In-memory state shared by the HTTP routes and the pollers. Lost on restart; the pollers backfill. */
export const MAX_PRINTS = Number(process.env.MAX_PRINTS ?? 20_000);
export const MAX_OFFEX = Number(process.env.MAX_OFFEX ?? 5_000);

export interface OffexPrint {
  time: string;
  symbol: string;
  price: number;
  size: number;
  notional: number;
  exchange: string;
  conditions: string[];
}

export const state = {
  prints: [] as FlowPrint[],
  offex: [] as OffexPrint[],
  snapshots: new Map<string, ChainSnapshot>(),
  quotes: new Map<string, ChainContract>(),
  previous: new Map<string, ChainContract[]>(),
  lastChainPoll: null as string | null,
  lastAlpacaPoll: null as string | null,
  alpacaCursor: null as string | null,
  errors: [] as { time: string; source: string; message: string }[],
  listeners: new Set<(event: { prints: FlowPrint[]; offex: OffexPrint[] }) => void>(),
};

export function noteError(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  state.errors.push({ time: new Date().toISOString(), source, message: message.slice(0, 300) });
  if (state.errors.length > 50) state.errors.splice(0, state.errors.length - 50);
  console.error(`[${source}] ${message}`);
}

function trim<T>(list: T[], max: number) {
  if (list.length > max) list.splice(0, list.length - max);
}

export function addPrints(next: FlowPrint[], offex: OffexPrint[] = []) {
  if (!next.length && !offex.length) return;
  state.prints.push(...next);
  state.prints.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  trim(state.prints, MAX_PRINTS);
  state.offex.push(...offex);
  state.offex.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  trim(state.offex, MAX_OFFEX);
  for (const listener of state.listeners) listener({ prints: next, offex });
}

/** Stores a chain snapshot. The first snapshot of a symbol is only a baseline, so the day's volume is not emitted as one print. */
export function ingestChain(snapshot: ChainSnapshot, emit: boolean, time = new Date().toISOString()): FlowPrint[] {
  const symbol = snapshot.symbol;
  state.snapshots.set(symbol, snapshot);
  for (const contract of snapshot.contracts) state.quotes.set(contract.symbol, contract);
  const prior = state.previous.get(symbol);
  state.previous.set(symbol, snapshot.contracts);
  if (!prior || !emit) return [];
  const next = withFlags(diffChain(prior, snapshot.contracts, time));
  addPrints(next);
  return next;
}
