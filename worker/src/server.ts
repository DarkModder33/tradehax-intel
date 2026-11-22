import http from "node:http";
import { healthBody } from "../../src/lib/live/worker.ts";
import type { FlowPrint } from "../../src/lib/flow/classify.ts";
import { repeatedHits } from "../../src/lib/flow/rules.ts";
import { tideBar, topNetImpact } from "../../src/lib/flow/tide.ts";
import { nope } from "../../src/lib/flow/nope.ts";
import { hotByPremium } from "../../src/lib/flow/rank.ts";
import { alpacaConfigured } from "./alpaca.ts";
import { history, state } from "./store.ts";
import { SYMBOLS, startPollers } from "./poller.ts";
import { barsPayload, chainPayload, newsPayload, summaryPayload, technicalsPayload } from "./market.ts";
import { cacheControl, isHeavy, rateLimit } from "./guard.ts";
import { unusualScore } from "../../src/lib/flow/score.ts";
import { optionBarsUrl } from "./alpaca.ts";

const port = Number(process.env.PORT ?? 8787);
const origins = (process.env.ALLOWED_ORIGIN ?? "https://tradehaxai.tech,https://www.tradehaxai.tech,https://darkmodder33.github.io")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export { ingestChain } from "./store.ts";

export function noteLive(): { connected: boolean; alpaca: boolean; message: string } {
  const alpaca = alpacaConfigured();
  if (!alpaca && state.snapshots.size === 0) return { connected: false, alpaca: false, message: "live feed not connected" };
  return {
    connected: true,
    alpaca,
    message: alpaca ? "15-min delayed Alpaca prints with Cboe quotes" : "Inferred prints from Cboe chain diffs (no Alpaca key)",
  };
}

function corsHeaders(requestOrigin: string | undefined): Record<string, string> {
  const allow = requestOrigin && origins.includes(requestOrigin) ? requestOrigin : origins[0];
  return { "access-control-allow-origin": allow, "access-control-allow-methods": "GET, OPTIONS", vary: "Origin" };
}

const hitsByIp = new Map<string, number[]>();

function json(res: http.ServerResponse, status: number, body: unknown, cors: Record<string, string>, path = "/") {
  res.writeHead(status, { "content-type": "application/json", "cache-control": cacheControl(path), ...cors });
  res.end(JSON.stringify(body));
}

/** Newest first, filtered by ?symbol=, ?minPremium=, ?flag=, and capped by ?limit= (default 500, max 5000). */
function filterPrints(url: URL, prints: FlowPrint[]): FlowPrint[] {
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  const minPremium = Number(url.searchParams.get("minPremium") ?? 0);
  const flag = url.searchParams.get("flag");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500) || 500, 5000);
  const out: FlowPrint[] = [];
  for (let i = prints.length - 1; i >= 0 && out.length < limit; i--) {
    const print = prints[i];
    if (symbol && print.root !== symbol) continue;
    if (print.premium < minPremium) continue;
    if (flag && !print.flags.includes(flag)) continue;
    out.push(print);
  }
  return withScores(out);
}

function withScores(prints: FlowPrint[]): FlowPrint[] {
  const premiums = prints.map((print) => print.premium).sort((a, b) => a - b);
  const median = premiums.length ? premiums[Math.floor(premiums.length / 2)] : 0;
  return prints.map((print) => {
    const scored = unusualScore({
      premium: print.premium,
      medianPremium: median,
      volume: print.size,
      openInterest: 0,
      askSide: print.side === "ASK",
      sweep: print.flags.includes("sweep"),
      otmFraction: 0,
      dte: 15,
      repeats: 0,
      daysToEarnings: null,
    }, premiums.length);
    return { ...print, score: scored.score, scoreStatus: scored.status };
  });
}

export async function handle(url: URL, res: http.ServerResponse, requestOrigin?: string, ip = "local") {
  const cors = corsHeaders(requestOrigin);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (isHeavy(path)) {
    const decision = rateLimit(hitsByIp.get(ip) ?? [], Date.now());
    hitsByIp.set(ip, decision.next);
    if (!decision.allowed) {
      json(res, 429, { error: "rate limit", limit: "60/min" }, cors, path);
      return;
    }
  }
  const live = noteLive();
  if (path === "/v1/push/key") {
    const publicKey = process.env.VAPID_PUBLIC;
    const enabled = Boolean(publicKey && process.env.VAPID_PRIVATE && process.env.VAPID_SUBJECT && process.env.CF_ACCOUNT_ID && process.env.CF_KV_NAMESPACE_ID && process.env.CF_API_TOKEN);
    json(res, 200, { enabled, publicKey: enabled ? publicKey : null, note: enabled ? "Push is configured." : "Push is coming soon. Set VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, and CF_API_TOKEN on the worker. Do not commit them." }, cors, path);
    return;
  }
  if (path.startsWith("/v1/optbars/")) {
    const occ = decodeURIComponent(path.slice("/v1/optbars/".length)).toUpperCase();
    if (!alpacaConfigured()) {
      json(res, 503, { error: "alpaca not configured", source: "unavailable", bars: [] }, cors, path);
      return;
    }
    try {
      const payload = await fetch(optionBarsUrl(occ), { headers: { "APCA-API-KEY-ID": process.env.ALPACA_KEY_ID ?? "", "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET ?? "" } });
      const body = await payload.json();
      json(res, payload.ok ? 200 : payload.status, { source: "Alpaca option bars", delay: "about 15 min", body }, cors, path);
    } catch (error) {
      json(res, 502, { error: error instanceof Error ? error.message : "optbars failed", source: "unavailable" }, cors, path);
    }
    return;
  }
  if (path.startsWith("/v1/bars/")) {
    const symbol = decodeURIComponent(path.slice("/v1/bars/".length));
    const result = await barsPayload(symbol, url.searchParams.get("tf"), url.searchParams.get("limit"));
    json(res, result.status, { ...live, ...asRecord(result.body) }, cors);
    return;
  }
  if (path.startsWith("/v1/chain-summary/")) {
    const symbol = decodeURIComponent(path.slice("/v1/chain-summary/".length));
    const result = await summaryPayload(symbol);
    json(res, result.status, result.body, cors);
    return;
  }
  if (path.startsWith("/v1/chain/")) {
    const symbol = decodeURIComponent(path.slice("/v1/chain/".length));
    const result = await chainPayload(symbol);
    json(res, result.status, result.body, cors);
    return;
  }
  if (path === "/v1/technicals") {
    const result = await technicalsPayload();
    json(res, result.status, result.body, cors);
    return;
  }
  if (path === "/v1/news") {
    const result = await newsPayload(url.searchParams.get("q") ?? "", url.searchParams.get("newsCount"));
    json(res, result.status, result.body, cors);
    return;
  }
  if (path === "/v1/health" || path === "/health" || path === "/") {
    json(res, 200, {
      ...healthBody(),
      ...live,
      symbols: SYMBOLS,
      universeSize: state.snapshots.size,
      contractsQuoted: state.quotes.size,
      prints: state.prints.length,
      offexPrints: state.offex.length,
      lastPoll: state.lastChainPoll,
      lastAlpacaPoll: state.lastAlpacaPoll,
      alpacaThrough: state.alpacaCursor,
      lastPrint: state.prints.at(-1)?.time ?? null,
      recentErrors: state.errors.slice(-5),
    }, cors);
    return;
  }
  if (path === "/v1/flow" || path === "/v1/interval") {
    json(res, 200, { ...live, prints: filterPrints(url, state.prints), total: state.prints.length, delay: "about 15 min", inferred: !live.alpaca }, cors);
    return;
  }
  if (path === "/v1/hot") {
    json(res, 200, { ...live, hot: hotByPremium(state.prints) }, cors);
    return;
  }
  if (path.startsWith("/v1/ticker/")) {
    const symbol = decodeURIComponent(path.split("/").pop() ?? "").toUpperCase();
    const mine = state.prints.filter((print) => print.root === symbol);
    const spotVolume = state.snapshots.get(symbol)?.volume ?? 0;
    json(res, 200, {
      ...live,
      symbol,
      prints: mine.slice(-30).reverse(),
      tide: tideBar(mine),
      nope: nope(mine.map((print) => ({ right: print.right, volume: print.size, delta: print.delta })), spotVolume || 1),
      offex: state.offex.filter((print) => print.symbol === symbol).slice(-20),
      hot: hotByPremium(mine, 5),
    }, cors);
    return;
  }
  if (path === "/v1/history") {
    const date = url.searchParams.get("date");
    const symbol = url.searchParams.get("symbol")?.toUpperCase();
    const days = date ? [date] : [...history.keys()].sort();
    const prints = days.flatMap((day) => history.get(day) ?? []).filter((print) => !symbol || print.root === symbol);
    json(res, 200, { ...live, days, prints: prints.slice(-5000) }, cors);
    return;
  }
  if (path === "/v1/alerts") {
    json(res, 200, { ...live, alerts: repeatedHits(state.prints), sweeps: filterPrints(url, state.prints.filter((p) => p.flags.includes("sweep"))) }, cors);
    return;
  }
  if (path === "/v1/tide" || path === "/v1/top-net-impact") {
    json(res, 200, { ...live, tide: tideBar(state.prints), impact: topNetImpact(state.prints) }, cors);
    return;
  }
  if (path.startsWith("/v1/netflow/") || path.startsWith("/v1/nope/")) {
    const symbol = decodeURIComponent(path.split("/").pop() ?? "").toUpperCase();
    const mine = state.prints.filter((print) => print.root === symbol);
    const spotVolume = state.snapshots.get(symbol)?.volume ?? 1;
    json(res, 200, {
      ...live,
      symbol,
      tide: tideBar(mine),
      nope: nope(mine.map((print) => ({ right: print.right, volume: print.size, delta: print.delta })), spotVolume || 1),
    }, cors);
    return;
  }
  if (path.startsWith("/v1/offex")) {
    const symbol = url.searchParams.get("symbol")?.toUpperCase();
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 500) || 500, 5000);
    const prints = state.offex.filter((print) => !symbol || print.symbol === symbol).slice(-limit).reverse();
    json(res, 200, {
      ...live,
      prints,
      note: live.alpaca ? "SIP prints reported to a FINRA TRF (exchange D), 15-min delayed. Not limited to dark pools." : "15-min TRF prints need Alpaca keys. Daily FINRA off-exchange volume is on the short-volume page.",
    }, cors);
    return;
  }
  if (path === "/v1/stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", ...cors });
    const send = (event: string, body: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(body)}\n\n`);
    send("hello", { ...live, tide: tideBar(state.prints), prints: filterPrints(url, state.prints).slice(0, 100) });
    const listener = (update: { prints: FlowPrint[]; offex: unknown[] }) => send("prints", { ...update, tide: tideBar(state.prints) });
    state.listeners.add(listener);
    // Heroku closes idle connections after 55 s.
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);
    res.on("close", () => {
      clearInterval(heartbeat);
      state.listeners.delete(listener);
    });
    return;
  }
  json(res, 404, { error: "not found" }, cors);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const server = http.createServer((req, res) => {
  const requestOrigin = req.headers.origin;
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(requestOrigin));
    res.end();
    return;
  }
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.socket.remoteAddress || "local";
  void handle(new URL(req.url ?? "/", "http://localhost"), res, requestOrigin, ip).catch((error) => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: "internal error" }, corsHeaders(requestOrigin));
  });
});

// Tests import this module; the process entry (server.ts or the bundled server.mjs) starts listening.
if (!process.env.VITEST && /server\.(ts|mjs|js)$/.test(process.argv[1] ?? "")) {
  server.listen(port, () => {
    console.log(`tradehax worker listening on ${port}`);
    startPollers();
  });
}

export { server };
