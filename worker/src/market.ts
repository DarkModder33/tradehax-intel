import { clampBarLimit, isBarTimeframe, parseAlpacaBars, stockBarsUrl } from "../../src/lib/market/alpaca-bars.ts";
import { parseNews, yahooNewsUpstream } from "../../src/lib/market/news.ts";
import { summarizeChain } from "../../src/lib/options/summary.ts";
import { cboeChainUrl, parseCboeChain, type ChainSnapshot } from "../../src/lib/sources/cboe.ts";
import { alpacaConfigured, alpacaHeaders } from "./alpaca.ts";
import { snapshotAt, state } from "./store.ts";

const TTL_MS = 60_000;
const barsCache = new Map<string, { expires: number; body: unknown }>();
const summaryCache = new Map<string, { expires: number; body: unknown }>();

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, { headers: { "user-agent": "tradehax-worker", accept: "application/json", ...headers } });
  if (!response.ok) throw new Error(`${new URL(url).host} returned ${response.status}`);
  return response.json();
}

/** Reuse a chain the poller stored in the last minute, otherwise fetch Cboe once for every route. */
export async function loadChain(symbol: string, now = Date.now()): Promise<ChainSnapshot> {
  const root = symbol.trim().toUpperCase();
  const storedAt = snapshotAt.get(root) ?? 0;
  const stored = state.snapshots.get(root);
  if (stored && now - storedAt < TTL_MS) return stored;
  const snapshot = parseCboeChain(await getJson(cboeChainUrl(root)), root);
  state.snapshots.set(root, snapshot);
  snapshotAt.set(root, now);
  for (const contract of snapshot.contracts) state.quotes.set(contract.symbol, contract);
  return snapshot;
}

export async function barsPayload(symbol: string, tf: string | null, limitRaw: string | null, now = Date.now()): Promise<{ status: number; body: unknown }> {
  const root = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(root)) return { status: 400, body: { error: "bad symbol" } };
  if (!isBarTimeframe(tf)) return { status: 400, body: { error: "tf must be 1Min, 5Min, 15Min, 1Hour, or 1Day" } };
  if (!alpacaConfigured()) return { status: 503, body: { error: "alpaca not configured", source: "unavailable" } };
  const limit = clampBarLimit(Number(limitRaw ?? 300));
  const key = `${root}|${tf}|${limit}`;
  const hit = barsCache.get(key);
  if (hit && hit.expires > now) return { status: 200, body: hit.body };
  const bars = parseAlpacaBars(await getJson(stockBarsUrl(root, tf, limit), alpacaHeaders()), root);
  const body = { symbol: root, tf, source: "Alpaca SIP", delay: "about 15 min", bars };
  barsCache.set(key, { expires: now + TTL_MS, body });
  return { status: 200, body };
}

export async function chainPayload(symbol: string): Promise<{ status: number; body: unknown }> {
  try {
    const snapshot = await loadChain(symbol);
    return { status: 200, body: { snapshot, source: "Cboe delayed via worker", delay: snapshot.delay } };
  } catch (error) {
    return { status: 502, body: { error: error instanceof Error ? error.message : "chain failed", source: "unavailable" } };
  }
}

export async function summaryPayload(symbol: string, now = Date.now()): Promise<{ status: number; body: unknown }> {
  const root = symbol.trim().toUpperCase();
  const hit = summaryCache.get(root);
  if (hit && hit.expires > now) return { status: 200, body: hit.body };
  try {
    const snapshot = await loadChain(root);
    const summary = summarizeChain(snapshot, new Date(now), "Cboe delayed via worker");
    summaryCache.set(root, { expires: now + TTL_MS, body: summary });
    return { status: 200, body: summary };
  } catch (error) {
    return { status: 502, body: { error: error instanceof Error ? error.message : "summary failed", source: "unavailable" } };
  }
}

export async function newsPayload(query: string, countRaw: string | null): Promise<{ status: number; body: unknown }> {
  const q = query.trim();
  if (!q) return { status: 400, body: { error: "missing q" } };
  const count = Math.min(Number(countRaw ?? 8) || 8, 20);
  try {
    const payload = await getJson(yahooNewsUpstream(q, count));
    return { status: 200, body: { source: "Yahoo Finance via worker", news: parseNews(payload, count) } };
  } catch (error) {
    return { status: 502, body: { error: error instanceof Error ? error.message : "news failed", source: "unavailable" } };
  }
}
