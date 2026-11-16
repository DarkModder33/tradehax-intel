import { parseCboeChain, cboeChainUrl } from "../../src/lib/sources/cboe.ts";
import { parseOcc } from "../../src/lib/sources/occ.ts";
import { inferSide, sentiment, withFlags, type FlowPrint } from "../../src/lib/flow/classify.ts";
import { optionTradesUrl, stockTradesUrl, alpacaConfigured } from "./alpaca.ts";
import { addPrints, ingestChain, noteError, state, type OffexPrint } from "./store.ts";
import { parseUniverse } from "../../src/lib/live/universe.ts";
import { inSession, lastSessionEnd } from "./time.ts";

export const SYMBOLS = parseUniverse(process.env.UNIVERSE ?? process.env.WORKER_SYMBOLS);
const CHAIN_BATCH = Number(process.env.CHAIN_BATCH ?? 8);
const STOCK_BATCH = Number(process.env.STOCK_BATCH ?? 10);
let chainCursor = 0;
let stockCursor = 0;
const CHAIN_POLL_SEC = Number(process.env.CHAIN_POLL_SEC ?? 120);
const ALPACA_POLL_SEC = Number(process.env.ALPACA_POLL_SEC ?? 60);
const WATCH_CONTRACTS = Number(process.env.WATCH_CONTRACTS ?? 400);
const BACKFILL_MIN = Number(process.env.BACKFILL_MIN ?? 30);
const OFFEX_MIN_NOTIONAL = Number(process.env.OFFEX_MIN_NOTIONAL ?? 1_000_000);
const MIN_OPTION_PREMIUM = Number(process.env.MIN_OPTION_PREMIUM ?? 5_000);
const DELAY_MS = 15.5 * 60_000;
const MAX_PAGES = 20;

/** OPRA condition letters from Alpaca's /v1beta1/options/meta/conditions/trade. Only the ISO ones carry "ISO". */
const OPTION_CONDITIONS: Record<string, string> = {
  I: "AUTO", S: "ISO", a: "SLAN", b: "ISO", c: "SLCN", d: "ISO", e: "SLFT", f: "MLET", g: "MLAT", h: "MLCT",
  i: "MLFT", j: "MESL", k: "TLAT", l: "MASL", m: "MFSL", n: "TLET", o: "TLCT", p: "TLFT", q: "TESL", r: "TASL",
  s: "TFSL", t: "CBMO", u: "MCTP", v: "EXHT",
};
const MULTI_LEG = new Set(["f", "g", "h", "i", "j", "l", "m", "k", "n", "o", "p", "q", "r", "s", "t", "u"]);

function alpacaHeaders(): Record<string, string> {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_KEY_ID ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET ?? "",
  };
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, { headers: { "user-agent": "tradehax-worker", ...headers } });
  if (!response.ok) throw new Error(`${new URL(url).host}${new URL(url).pathname} returned ${response.status}`);
  return response.json();
}

export async function pollChains(): Promise<void> {
  const emit = !alpacaConfigured();
  const slice: string[] = [];
  for (let index = 0; index < Math.min(CHAIN_BATCH, SYMBOLS.length); index++) slice.push(SYMBOLS[(chainCursor + index) % SYMBOLS.length]);
  chainCursor = SYMBOLS.length ? (chainCursor + slice.length) % SYMBOLS.length : 0;
  for (const symbol of slice) {
    try {
      const snapshot = parseCboeChain(await getJson(cboeChainUrl(symbol)), symbol);
      ingestChain(snapshot, emit);
    } catch (error) {
      noteError(`cboe ${symbol}`, error);
    }
  }
  state.lastChainPoll = new Date().toISOString();
}

/** Most active contracts across the universe, plus anything trading above its open interest. */
export function watchList(): string[] {
  const all = [...state.snapshots.values()].flatMap((snapshot) => snapshot.contracts).filter((contract) => contract.volume > 0);
  all.sort((a, b) => b.volume * Math.max(b.last, 0.01) - a.volume * Math.max(a.last, 0.01));
  const picked = new Set(all.slice(0, WATCH_CONTRACTS).map((contract) => contract.symbol));
  for (const contract of all) {
    if (picked.size >= WATCH_CONTRACTS * 1.5) break;
    if (contract.volume > contract.openInterest && contract.volume >= 500) picked.add(contract.symbol);
  }
  return [...picked];
}

interface RawTrade {
  t: string;
  x: string;
  p: number;
  s: number;
  c: string | string[];
}

async function pagedTrades(base: string): Promise<Record<string, RawTrade[]>> {
  const out: Record<string, RawTrade[]> = {};
  let token: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(base);
    url.searchParams.set("limit", "10000");
    if (token) url.searchParams.set("page_token", token);
    const body = (await getJson(url.toString(), alpacaHeaders())) as { trades?: Record<string, RawTrade[]>; next_page_token?: string | null };
    for (const [symbol, trades] of Object.entries(body.trades ?? {})) (out[symbol] ??= []).push(...trades);
    token = body.next_page_token ?? null;
    if (!token) break;
  }
  return out;
}

export function optionPrint(contract: string, trade: RawTrade): FlowPrint | null {
  const occ = parseOcc(contract);
  if (!occ) return null;
  const quote = state.quotes.get(contract);
  const code = Array.isArray(trade.c) ? trade.c[0] ?? "" : trade.c ?? "";
  const side = quote ? inferSide(trade.p, quote.bid, quote.ask) : "MID";
  const premium = trade.s * trade.p * 100;
  const flags: string[] = [];
  if (MULTI_LEG.has(code)) flags.push("multileg");
  return {
    time: trade.t,
    contract,
    root: occ.root,
    expiry: occ.expiry,
    strike: occ.strike,
    right: occ.right,
    side,
    size: trade.s,
    price: trade.p,
    premium,
    delta: quote?.delta ?? 0,
    exchange: trade.x,
    conditions: code ? [OPTION_CONDITIONS[code] ?? code] : [],
    inferred: false,
    sentiment: sentiment(occ.right, side),
    flags,
  };
}

function window(now: Date): { start: string; end: string } | null {
  const end = new Date(now.getTime() - DELAY_MS);
  if (!state.alpacaCursor) {
    const anchor = inSession(end) ? end : lastSessionEnd(end);
    return { start: new Date(anchor.getTime() - BACKFILL_MIN * 60_000).toISOString(), end: anchor.toISOString() };
  }
  // Off hours, stop at the last session end; after a night or weekend, skip the dead hours.
  const sessionEnd = inSession(end) ? end : lastSessionEnd(end);
  const cursor = Date.parse(state.alpacaCursor);
  if (sessionEnd.getTime() <= cursor) return null;
  const start = Math.max(cursor, sessionEnd.getTime() - Math.max(BACKFILL_MIN, 60) * 60_000);
  return { start: new Date(start).toISOString(), end: sessionEnd.toISOString() };
}

export async function pollAlpaca(now = new Date()): Promise<void> {
  if (!alpacaConfigured() || state.snapshots.size === 0) return;
  const span = window(now);
  if (!span) return;
  const prints: FlowPrint[] = [];
  const offex: OffexPrint[] = [];
  let failed = false;
  const contracts = watchList();
  for (let i = 0; i < contracts.length; i += 100) {
    try {
      const trades = await pagedTrades(optionTradesUrl(contracts.slice(i, i + 100), span.start, span.end));
      for (const [contract, list] of Object.entries(trades)) {
        for (const trade of list) {
          const print = optionPrint(contract, trade);
          if (print && print.premium >= MIN_OPTION_PREMIUM) prints.push(print);
        }
      }
    } catch (error) {
      failed = true;
      noteError("alpaca options", error);
    }
  }
  const stockSlice: string[] = [];
  for (let index = 0; index < Math.min(STOCK_BATCH, SYMBOLS.length); index++) stockSlice.push(SYMBOLS[(stockCursor + index) % SYMBOLS.length]);
  stockCursor = SYMBOLS.length ? (stockCursor + stockSlice.length) % SYMBOLS.length : 0;
  for (const symbol of stockSlice) {
    try {
      const trades = await pagedTrades(stockTradesUrl([symbol], span.start, span.end));
      for (const trade of trades[symbol] ?? []) {
        const notional = trade.p * trade.s;
        if (trade.x !== "D" || notional < OFFEX_MIN_NOTIONAL) continue;
        offex.push({ time: trade.t, symbol, price: trade.p, size: trade.s, notional, exchange: trade.x, conditions: Array.isArray(trade.c) ? trade.c.map((c) => c.trim()).filter(Boolean) : [] });
      }
    } catch (error) {
      failed = true;
      noteError(`alpaca stocks ${symbol}`, error);
    }
  }
  // Sweep detection needs the whole batch, so flags are set after collection.
  // classify.ts treats exchange D as off-exchange, which is a stock TRF code. For OPRA it is an options exchange, so drop that flag.
  const flagged = withFlags(prints).map((print) => ({ ...print, flags: print.flags.filter((flag) => flag !== "off-exchange") }));
  addPrints(flagged, offex);
  if (!failed || prints.length || offex.length) state.alpacaCursor = span.end;
  state.lastAlpacaPoll = new Date().toISOString();
  console.log(`alpaca ${span.start} -> ${span.end}: ${contracts.length} contracts, ${prints.length} option prints, ${offex.length} off-exchange blocks`);
}

let chainBusy = false;
let alpacaBusy = false;

export function startPollers(): void {
  const chainTick = async () => {
    if (chainBusy) return;
    chainBusy = true;
    try {
      await pollChains();
    } finally {
      chainBusy = false;
    }
  };
  const alpacaTick = async () => {
    if (alpacaBusy) return;
    alpacaBusy = true;
    try {
      await pollAlpaca();
    } catch (error) {
      noteError("alpaca", error);
    } finally {
      alpacaBusy = false;
    }
  };
  void chainTick().then(alpacaTick);
  setInterval(chainTick, CHAIN_POLL_SEC * 1000);
  setInterval(alpacaTick, ALPACA_POLL_SEC * 1000);
  console.log(`pollers started: ${SYMBOLS.join(",")} chains every ${CHAIN_POLL_SEC}s, alpaca ${alpacaConfigured() ? `every ${ALPACA_POLL_SEC}s` : "off (no keys)"}`);
}
