import { workerConnected, workerUrl } from "@/lib/live/worker";
import type { KvCache } from "./cache";
import { sharedCache } from "./idb-cache";
import { isStandardContract, parseOcc, type OccContract } from "./occ";
import { proxiedUrl } from "./proxy";

export interface ChainContract extends OccContract {
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  theo: number;
  openInterest: number;
  volume: number;
  last: number;
  lastTradeTime: string | null;
}

export interface ChainSnapshot {
  symbol: string;
  spot: number;
  iv30: number | null;
  asOf: string | null;
  volume: number | null;
  contracts: ChainContract[];
  source: "Cboe delayed";
  delay: "about 15 min";
}

export function cboeChainUrl(symbol: string): string {
  const root = symbol.trim().toUpperCase();
  return `https://cdn.cboe.com/api/global/delayed_quotes/options/${root}.json`;
}

export function cboeChainRequestUrl(symbol: string): string {
  return proxiedUrl(cboeChainUrl(symbol));
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseCboeChain(payload: unknown, root: string): ChainSnapshot {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const symbol = String(data.symbol ?? root).toUpperCase();
  const options = Array.isArray(data.options) ? data.options : [];
  const contracts: ChainContract[] = [];
  for (const row of options) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const option = String(raw.option ?? "");
    if (!isStandardContract(option, symbol)) continue;
    const parsed = parseOcc(option);
    if (!parsed) continue;
    contracts.push({
      ...parsed,
      bid: num(raw.bid),
      ask: num(raw.ask),
      iv: num(raw.iv),
      delta: num(raw.delta),
      gamma: num(raw.gamma),
      vega: num(raw.vega),
      theta: num(raw.theta),
      rho: num(raw.rho),
      theo: num(raw.theo),
      openInterest: num(raw.open_interest),
      volume: num(raw.volume),
      last: num(raw.last_trade_price),
      lastTradeTime: typeof raw.last_trade_time === "string" ? raw.last_trade_time : null,
    });
  }
  return {
    symbol,
    spot: num(data.current_price),
    iv30: typeof data.iv30 === "number" ? data.iv30 : null,
    asOf: typeof body.timestamp === "string" ? body.timestamp : null,
    volume: typeof data.volume === "number" ? data.volume : null,
    contracts,
    source: "Cboe delayed",
    delay: "about 15 min",
  };
}

const CHAIN_TTL_MS = 60_000;
let chainCache: KvCache | null = null;

export function setChainCache(cache: KvCache): void {
  chainCache = cache;
}

function cache(): KvCache {
  chainCache ??= sharedCache();
  return chainCache;
}

/** Parse off the main thread when the browser can spawn a module worker. */
export function parseChainOffThread(payload: unknown, root: string): Promise<ChainSnapshot> {
  if (typeof Worker === "undefined") return Promise.resolve(parseCboeChain(payload, root));
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./chain.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(parseCboeChain(payload, root));
      return;
    }
    const finish = (snapshot: ChainSnapshot) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(snapshot);
    };
    const timer = setTimeout(() => finish(parseCboeChain(payload, root)), 8_000);
    worker.onmessage = (event: MessageEvent<ChainSnapshot>) => finish(event.data);
    worker.onerror = () => finish(parseCboeChain(payload, root));
    worker.postMessage({ payload, root });
  });
}

/**
 * One chain per symbol for 60 seconds, shared across pages through IndexedDB.
 * The worker is first. The cors.dev proxy is the fallback.
 */
export async function fetchChain(symbol: string, fetcher: typeof fetch = fetch): Promise<ChainSnapshot> {
  const root = symbol.trim().toUpperCase();
  const key = `chain:${root}`;
  const hit = await cache().get(key);
  if (hit) return JSON.parse(hit) as ChainSnapshot;

  const errors: string[] = [];
  if (workerConnected()) {
    try {
      const response = await fetcher(`${workerUrl()}/v1/chain/${encodeURIComponent(root)}`);
      if (response.ok) {
        const body = (await response.json()) as { snapshot?: ChainSnapshot };
        const snapshot = body.snapshot ?? (await parseChainOffThread(body, root));
        await cache().set(key, JSON.stringify(snapshot), CHAIN_TTL_MS);
        return snapshot;
      }
      errors.push(`worker ${response.status}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "worker");
    }
  }

  const response = await fetcher(cboeChainRequestUrl(root));
  if (!response.ok) {
    const extra = errors.length ? ` after ${errors.join("; ")}` : "";
    throw new Error(`Cboe chain ${root} returned ${response.status}${extra}`);
  }
  const snapshot = await parseChainOffThread(await response.json(), root);
  await cache().set(key, JSON.stringify(snapshot), CHAIN_TTL_MS);
  return snapshot;
}
