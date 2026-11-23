import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeStories } from "./engine.mjs";
import { buildDeskStories, headlineTickers } from "./desk.mjs";

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

const root = process.cwd();
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "public", "data");
const outFile = path.resolve(process.env.NEWS_OUT ?? path.join(root, "content", "news", "stories.json"));
const priorFile = process.env.NEWS_PRIOR ? path.resolve(process.env.NEWS_PRIOR) : outFile;

const input = {
  technicals: await readJson(path.join(dataDir, "technicals.json")),
  shorts: await readJson(path.join(dataDir, "shorts.json")),
  ftd: await readJson(path.join(dataDir, "ftd.json")),
  insiders: await readJson(path.join(dataDir, "insiders.json")),
  oiChange: await readJson(path.join(dataDir, "oi-change.json")),
  earnings: await readJson(path.join(dataDir, "earnings-moves.json")),
  iv: await readJson(path.join(dataDir, "iv.json")),
  ivHistory: await readJson(path.join(dataDir, "iv-history.json")),
  macro: await readJson(path.join(dataDir, "macro.json")),
  macroPrevious: await readJson(process.env.PREV_DIR ? path.join(process.env.PREV_DIR, "macro.json") : ""),
  optionsHistory: await readJson(path.join(dataDir, "options-history.json")),
};

const workerBase = (process.env.WORKER_URL ?? "").replace(/\/$/, "");
const DESK_SYMBOLS = ["SPY", "QQQ", "IWM", "DIA", "SMH", "GLD", "TLT", "HYG", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLB", "XLU", "XLRE", "XLC",
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRKB", "JPM", "V", "UNH", "XOM", "LLY", "MA", "COST", "HD", "PG", "JNJ",
  "BAC", "AMD", "NFLX", "CRM", "ORCL", "KO", "WMT", "CVX", "MRK", "ABBV", "PLTR", "COIN", "MSTR", "BA"];

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const nyDay = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

async function loadBars() {
  const bars = {};
  if (!workerBase) return bars;
  const queue = [...DESK_SYMBOLS];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const sym = queue.shift();
      try {
        const body = await getJson(`${workerBase}/v1/bars/${encodeURIComponent(sym === "BRKB" ? "BRK.B" : sym)}?tf=1Day&limit=260`);
        bars[sym] = (body.bars ?? []).map((bar) => ({ date: nyDay(Number(bar.time)), close: Number(bar.close), volume: Number(bar.volume) }));
      } catch {
        // A missing symbol only removes its own story.
      }
    }
  }));
  return bars;
}

input.bars = await loadBars();
input.headlines = {};
for (const sym of headlineTickers(input.bars)) {
  try {
    const body = await getJson(`${workerBase}/v1/news?q=${encodeURIComponent(sym)}&newsCount=6`);
    input.headlines[sym] = body.news ?? [];
  } catch {
    input.headlines[sym] = [];
  }
}
console.log(`news: bars for ${Object.keys(input.bars).length} symbols, headlines for ${Object.keys(input.headlines).join(", ") || "none"}`);
const fresh = buildDeskStories(input, { cap: Number(process.env.NEWS_CAP ?? 6), log: (line) => console.log(line) });
const previous = await readJson(priorFile);
// Stories that shipped in the repo seed file were already posted to social, so keep their
// URLs alive (mergeStories still ages them out after its keep window).
const seedFile = path.join(root, "content", "news", "stories.json");
const seed = path.resolve(seedFile) === outFile ? null : await readJson(seedFile);
// Retracted ids never come back, whichever file they were merged from.
const retracted = new Set(Object.keys((await readJson(path.join(root, "content", "news", "retracted.json")))?.retracted ?? {}));
const stories = mergeStories([...(seed?.stories ?? []), ...(previous?.stories ?? [])], fresh).filter((story) => !retracted.has(story.id));
if (retracted.size) console.log(`news: ${retracted.size} retracted id(s) filtered`);
const payload = {
  generatedAt: new Date().toISOString(),
  disclaimer: fresh[0]?.disclaimer ?? "Auto-generated from market data — not investment advice.",
  stories,
};
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`);
if (process.env.DATA_DIR) {
  const mirror = path.join(dataDir, "news", "stories.json");
  await mkdir(path.dirname(mirror), { recursive: true });
  await writeFile(mirror, `${JSON.stringify(payload, null, 2)}\n`);
}
console.log(`news: ${fresh.length} new, ${stories.length} stored, ${outFile}`);
