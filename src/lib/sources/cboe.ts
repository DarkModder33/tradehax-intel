import { workerConnected, workerUrl } from "@/lib/live/worker";
import type { KvCache } from "./cache";
import { parseCboeChain, type ChainSnapshot } from "./cboe-parse";
import { sharedCache } from "./idb-cache";
import { proxiedUrl } from "./proxy";

export { parseCboeChain, type ChainContract, type ChainSnapshot } from "./cboe-parse";

export function cboeChainUrl(symbol: string): string {
  const root = symbol.trim().toUpperCase();
  return `https://cdn.cboe.com/api/global/delayed_quotes/options/${root}.json`;
}

export function cboeChainRequestUrl(symbol: string): string {
  return proxiedUrl(cboeChainUrl(symbol));
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
