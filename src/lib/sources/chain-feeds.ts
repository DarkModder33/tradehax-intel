import { alpacaSymbol } from "@/lib/market/alpaca-bars";
import { parseCboeChain, cboeChainUrl, type ChainContract, type ChainSnapshot } from "./cboe";
import { isStandardContract, parseOcc } from "./occ";

export const CBOE_BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  referer: "https://www.cboe.com/",
  origin: "https://www.cboe.com",
  "accept-language": "en-US,en;q=0.9",
};

const RETRY_STATUS = new Set([403, 429, 500, 502, 503, 504]);

export function alpacaOptionSnapshotsUrl(symbol: string, pageToken?: string): string {
  const params = new URLSearchParams({ feed: "indicative", limit: "1000" });
  if (pageToken) params.set("page_token", pageToken);
  return `https://data.alpaca.markets/v1beta1/options/snapshots/${encodeURIComponent(alpacaSymbol(symbol))}?${params}`;
}

export function alpacaStockSnapshotUrl(symbol: string): string {
  return `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(alpacaSymbol(symbol))}/snapshot?feed=iex`;
}

export function yahooOptionsUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(alpacaSymbol(symbol).replace(/\./g, "-"))}`;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function contractFromOcc(symbol: string, root: string, fields: Partial<ChainContract>): ChainContract | null {
  if (!isStandardContract(symbol, root) && parseOcc(symbol)?.root !== root) {
    const parsed = parseOcc(symbol);
    if (!parsed || parsed.root !== root) return null;
  }
  const parsed = parseOcc(symbol);
  if (!parsed) return null;
  return {
    ...parsed,
    bid: fields.bid ?? 0,
    ask: fields.ask ?? 0,
    iv: fields.iv ?? 0,
    delta: fields.delta ?? 0,
    gamma: fields.gamma ?? 0,
    vega: fields.vega ?? 0,
    theta: fields.theta ?? 0,
    rho: fields.rho ?? 0,
    theo: fields.theo ?? 0,
    openInterest: fields.openInterest ?? 0,
    volume: fields.volume ?? 0,
    last: fields.last ?? 0,
    lastTradeTime: fields.lastTradeTime ?? null,
  };
}

export function parseAlpacaOptionSnapshots(payload: unknown, root: string, spot: number): ChainSnapshot | null {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const book = body.snapshots && typeof body.snapshots === "object" ? (body.snapshots as Record<string, unknown>) : {};
  const contracts: ChainContract[] = [];
  for (const [symbol, raw] of Object.entries(book)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const quote = row.latestQuote && typeof row.latestQuote === "object" ? (row.latestQuote as Record<string, unknown>) : {};
    const trade = row.latestTrade && typeof row.latestTrade === "object" ? (row.latestTrade as Record<string, unknown>) : {};
    const greeks = row.greeks && typeof row.greeks === "object" ? (row.greeks as Record<string, unknown>) : {};
    const contract = contractFromOcc(symbol, root, {
      bid: num(quote.bp),
      ask: num(quote.ap),
      last: num(trade.p),
      iv: num(row.impliedVolatility),
      delta: num(greeks.delta),
      gamma: num(greeks.gamma),
      theta: num(greeks.theta),
      vega: num(greeks.vega),
      rho: num(greeks.rho),
      volume: num(trade.s),
      openInterest: num(row.openInterest ?? row.open_interest),
      lastTradeTime: typeof trade.t === "string" ? trade.t : null,
    });
    if (contract) contracts.push(contract);
  }
  if (!contracts.length) return null;
  return {
    symbol: root,
    spot,
    iv30: null,
    asOf: new Date().toISOString(),
    volume: null,
    contracts,
    source: "Alpaca indicative",
    delay: "indicative, about 15 min",
  };
}

export function parseYahooOptions(payload: unknown, root: string): ChainSnapshot | null {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const chain = body.optionChain && typeof body.optionChain === "object" ? (body.optionChain as Record<string, unknown>) : {};
  const result = Array.isArray(chain.result) ? chain.result[0] : null;
  const row = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const quote = row.quote && typeof row.quote === "object" ? (row.quote as Record<string, unknown>) : {};
  const groups = Array.isArray(row.options) ? row.options : [];
  const contracts: ChainContract[] = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const side = group as Record<string, unknown>;
    for (const key of ["calls", "puts"] as const) {
      const listed = Array.isArray(side[key]) ? side[key] : [];
      for (const item of listed) {
        if (!item || typeof item !== "object") continue;
        const contractRow = item as Record<string, unknown>;
        const symbol = String(contractRow.contractSymbol ?? "");
        const contract = contractFromOcc(symbol, root, {
          bid: num(contractRow.bid),
          ask: num(contractRow.ask),
          last: num(contractRow.lastPrice),
          iv: num(contractRow.impliedVolatility),
          openInterest: num(contractRow.openInterest),
          volume: num(contractRow.volume),
          lastTradeTime: typeof contractRow.lastTradeDate === "number" ? new Date(contractRow.lastTradeDate * 1000).toISOString() : null,
        });
        if (contract) contracts.push(contract);
      }
    }
  }
  if (!contracts.length) return null;
  return {
    symbol: root,
    spot: num(quote.regularMarketPrice),
    iv30: null,
    asOf: new Date().toISOString(),
    volume: num(quote.regularMarketVolume) || null,
    contracts,
    source: "Yahoo options",
    delay: "delayed",
  };
}

export function readAlpacaSpot(payload: unknown): number {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const trade = body.latestTrade && typeof body.latestTrade === "object" ? (body.latestTrade as Record<string, unknown>) : body.trade && typeof body.trade === "object" ? (body.trade as Record<string, unknown>) : {};
  return num(trade.p);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
  attempts = 3,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetcher(url, init);
    if (response.ok || !RETRY_STATUS.has(response.status) || attempt === attempts - 1) return response;
    last = response;
    await sleep(200 * 2 ** attempt);
  }
  return last as Response;
}

export async function resolveChain(
  symbol: string,
  options: {
    fetcher?: typeof fetch;
    alpacaHeaders?: Record<string, string> | null;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<ChainSnapshot> {
  const root = symbol.trim().toUpperCase();
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep;
  const errors: string[] = [];

  try {
    const response = await fetchWithRetry(cboeChainUrl(root), { headers: CBOE_BROWSER_HEADERS }, fetcher, 3, sleep);
    if (response.ok) {
      const snapshot = parseCboeChain(await readJson(response), root);
      if (snapshot.contracts.length) return snapshot;
      errors.push("cboe empty");
    } else errors.push(`cboe ${response.status}`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "cboe");
  }

  if (options.alpacaHeaders?.["APCA-API-KEY-ID"] && options.alpacaHeaders["APCA-API-SECRET-KEY"]) {
    try {
      let spot = 0;
      try {
        const quote = await fetcher(alpacaStockSnapshotUrl(root), { headers: options.alpacaHeaders });
        if (quote.ok) spot = readAlpacaSpot(await readJson(quote));
      } catch {
        spot = 0;
      }
      let token: string | undefined;
      const pages: Record<string, unknown> = {};
      for (let page = 0; page < 4; page += 1) {
        const response = await fetcher(alpacaOptionSnapshotsUrl(root, token), { headers: options.alpacaHeaders });
        if (!response.ok) {
          errors.push(`alpaca ${response.status}`);
          break;
        }
        const body = (await readJson(response)) as { snapshots?: Record<string, unknown>; next_page_token?: string };
        Object.assign(pages, body.snapshots ?? {});
        token = body.next_page_token || undefined;
        if (!token) break;
      }
      const snapshot = parseAlpacaOptionSnapshots({ snapshots: pages }, root, spot);
      if (snapshot) return snapshot;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "alpaca");
    }
  }

  try {
    const response = await fetcher(yahooOptionsUrl(root), { headers: { "user-agent": CBOE_BROWSER_HEADERS["user-agent"], accept: "application/json" } });
    if (response.ok) {
      const snapshot = parseYahooOptions(await readJson(response), root);
      if (snapshot) return snapshot;
      errors.push("yahoo empty");
    } else errors.push(`yahoo ${response.status}`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "yahoo");
  }

  throw new Error(`No option chain for ${root}: ${errors.join("; ")}`);
}
