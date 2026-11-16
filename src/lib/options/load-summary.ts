import { workerConnected, workerUrl } from "@/lib/live/worker";
import { fetchChain } from "@/lib/sources/cboe";
import { summarizeChain, type ChainSummary } from "./summary";

function isSummary(value: unknown): value is ChainSummary {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<ChainSummary>;
  return typeof body.symbol === "string" && body.levels != null && typeof body.spot === "number";
}

/** Worker summary first (about 20 KB). A full chain, then a local summary, is the fallback. */
export async function fetchChainSummary(symbol: string, fetcher: typeof fetch = fetch): Promise<ChainSummary> {
  const root = symbol.trim().toUpperCase();
  if (workerConnected()) {
    try {
      const response = await fetcher(`${workerUrl()}/v1/chain-summary/${encodeURIComponent(root)}`);
      if (response.ok) {
        const body: unknown = await response.json();
        if (isSummary(body)) return body;
      }
    } catch {
      // The proxy path below still has the chain.
    }
  }
  const chain = await fetchChain(root, fetcher);
  return summarizeChain(chain, new Date(), chain.source);
}
