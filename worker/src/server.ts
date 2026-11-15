import http from "node:http";
import { healthBody } from "../../src/lib/live/worker.ts";

const port = Number(process.env.PORT ?? 8787);
const origin = process.env.ALLOWED_ORIGIN ?? "https://darkmodder33.github.io";

function headers() {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
  };
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers());
    res.end();
    return;
  }
  if (req.url?.startsWith("/v1/health")) {
    res.writeHead(200, headers());
    res.end(JSON.stringify(healthBody()));
    return;
  }
  res.writeHead(404, headers());
  res.end(JSON.stringify({ error: "not found" }));
});

if (process.argv[1]?.endsWith("server.ts")) {
  server.listen(port, () => {
    console.log(`tradehax worker listening on ${port}`);
  });
}

export { server };
