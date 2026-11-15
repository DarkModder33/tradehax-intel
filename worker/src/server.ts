import http from "node:http";
import { healthBody } from "../../src/lib/live/worker.ts";
import { diffChain } from "../../src/lib/flow/diff.ts";
import { withFlags, type FlowPrint } from "../../src/lib/flow/classify.ts";
import { repeatedHits } from "../../src/lib/flow/rules.ts";
import { tideBar, topNetImpact } from "../../src/lib/flow/tide.ts";
import { nope } from "../../src/lib/flow/nope.ts";
import type { ChainContract } from "../../src/lib/sources/cboe.ts";

const port = Number(process.env.PORT ?? 8787);
const origin = process.env.ALLOWED_ORIGIN ?? "https://darkmodder33.github.io";
const alpacaKey = process.env.ALPACA_KEY_ID ?? "";
const prints: FlowPrint[] = [];
const previous = new Map<string, ChainContract[]>();

export function noteLive(): { connected: boolean; alpaca: boolean; message: string } {
  if (!alpacaKey) {
    return {
      connected: false,
      alpaca: false,
      message: "live feed not connected",
    };
  }
  return { connected: true, alpaca: true, message: "15-min delayed Alpaca prints are configured" };
}

export function ingestChain(symbol: string, contracts: ChainContract[], time = new Date().toISOString()): FlowPrint[] {
  const prior = previous.get(symbol) ?? [];
  const next = withFlags(diffChain(prior, contracts, time));
  previous.set(symbol, contracts);
  prints.push(...next);
  return next;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

export function handle(url: URL, res: http.ServerResponse) {
  const path = url.pathname;
  if (path === "/v1/health") {
    json(res, 200, { ...healthBody(), ...noteLive(), universeSize: previous.size, lastPoll: prints.at(-1)?.time ?? null });
    return;
  }
  const live = noteLive();
  if (path === "/v1/flow" || path === "/v1/interval") {
    json(res, 200, { ...live, prints, delay: "about 15 min", inferred: true });
    return;
  }
  if (path === "/v1/alerts") {
    json(res, 200, { ...live, alerts: repeatedHits(prints) });
    return;
  }
  if (path === "/v1/tide" || path === "/v1/top-net-impact") {
    json(res, 200, { ...live, tide: tideBar(prints), impact: topNetImpact(prints) });
    return;
  }
  if (path.startsWith("/v1/netflow/") || path.startsWith("/v1/nope/")) {
    const symbol = decodeURIComponent(path.split("/").pop() ?? "");
    const mine = prints.filter((print) => print.root === symbol);
    json(res, 200, {
      ...live,
      symbol,
      tide: tideBar(mine),
      nope: nope(mine.map((print) => ({ right: print.right, volume: print.size, delta: print.delta })), 1),
    });
    return;
  }
  if (path.startsWith("/v1/offex")) {
    json(res, 200, {
      ...live,
      prints: prints.filter((print) => print.exchange === "D"),
      note: live.alpaca ? "TRF prints with exchange D. Not limited to dark pools." : "15-min TRF prints need Alpaca keys. Daily FINRA off-exchange volume is on the short-volume page.",
    });
    return;
  }
  if (path === "/v1/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "access-control-allow-origin": origin,
      "cache-control": "no-cache",
    });
    res.write(`data: ${JSON.stringify({ ...live, tide: tideBar(prints) })}\n\n`);
    res.end();
    return;
  }
  json(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, OPTIONS" });
    res.end();
    return;
  }
  handle(new URL(req.url ?? "/", "http://localhost"), res);
});

if (process.argv[1]?.endsWith("server.ts")) {
  server.listen(port, () => {
    console.log(`tradehax worker listening on ${port}`);
  });
}

export { server };
