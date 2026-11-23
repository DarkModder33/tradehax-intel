// Builds data/alerts.json: one-line machine alerts from the data files and the worker tape.
// Run with: node --experimental-strip-types scripts/alerts/generate.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { congressAlerts, earningsAlerts, flowAlerts, insiderAlerts, mergeAlerts, moverAlerts, optionsAlerts, shortAlerts, validateAlert } from "../../src/lib/alerts/feed.ts";
import { DEFAULT_UNIVERSE } from "../../src/lib/live/universe.ts";

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function nyDay(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

async function getJson(url, timeoutMs = 20000, retries = 2) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (response.status === 429 && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 20000));
      return getJson(url, timeoutMs, retries - 1);
    }
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Daily rows from the news job's bar cache: { SYM: [{ date, close, volume }] }. */
export function closesFromCache(cache, symbols, now) {
  const rows = [];
  const today = Date.parse(`${nyDay(now.getTime())}T00:00:00Z`);
  for (const sym of symbols) {
    const bars = (cache?.[sym] ?? []).filter((bar) => Number(bar.close) > 0);
    if (bars.length < 2) continue;
    const last = bars.at(-1);
    if (today - Date.parse(`${last.date}T00:00:00Z`) > 4 * 86_400_000) continue;
    const volumes = bars.slice(0, -1).slice(-20).map((bar) => Number(bar.volume)).filter((value) => value > 0);
    const avg = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : 0;
    rows.push({ ticker: sym, date: last.date, close: Number(last.close), previous: Number(bars.at(-2).close), volumeRatio: avg > 0 ? Number(last.volume) / avg : null });
  }
  return rows;
}

export async function dailyCloses(base, symbols, now) {
  const rows = [];
  const queue = [...symbols];
  const today = Date.parse(`${nyDay(now.getTime())}T00:00:00Z`);
  async function worker() {
    while (queue.length) {
      const raw = queue.shift();
      const symbol = raw === "BRKB" ? "BRK.B" : raw;
      try {
        const body = await getJson(`${base}/v1/bars/${encodeURIComponent(symbol)}?tf=1Day&limit=25`);
        const bars = (body.bars ?? []).filter((bar) => Number(bar.close) > 0);
        if (bars.length < 2) continue;
        const last = bars.at(-1);
        const prev = bars.at(-2);
        const date = nyDay(Number(last.time));
        if (today - Date.parse(`${date}T00:00:00Z`) > 4 * 86_400_000) continue;
        const volumes = bars.slice(0, -1).slice(-20).map((bar) => Number(bar.volume)).filter((value) => value > 0);
        const avg = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : 0;
        rows.push({ ticker: raw, date, close: Number(last.close), previous: Number(prev.close), volumeRatio: avg > 0 ? Number(last.volume) / avg : null });
      } catch {
        // One symbol failing leaves the rest of the feed intact.
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return rows;
}

export async function generate({ dataDir, base, now = new Date(), log = console.log }) {
  const today = nyDay(now.getTime());
  const read = (name) => readJson(path.join(dataDir, name));
  const [options, insiders, shorts, congress, earnings, previous] = await Promise.all([
    read("options-history.json"),
    read("insiders.json"),
    read("shorts.json"),
    read("congress.json"),
    read("earnings-moves.json"),
    read("alerts.json"),
  ]);
  const fresh = [];
  const sources = {};
  const add = (name, list) => {
    sources[name] = list.length;
    fresh.push(...list);
  };
  add("options-history", optionsAlerts(options?.series ?? {}));
  add("insiders", insiderAlerts(insiders?.rows ?? [], today));
  add("shorts", shortAlerts(shorts?.rows ?? [], today));
  add("congress", congressAlerts(congress?.rows ?? [], today));
  add("earnings", earningsAlerts(earnings?.rows ?? [], today));
  if (base) {
    try {
      const tape = await getJson(`${base}/v1/flow?minPremium=250000&limit=1500`);
      add("tape", flowAlerts(tape.prints ?? [], now));
    } catch (error) {
      log(`alerts: worker tape failed: ${error instanceof Error ? error.message : error}`);
    }
    const cache = process.env.BARS_CACHE ? await readJson(process.env.BARS_CACHE) : null;
    const cached = cache ? closesFromCache(cache, [...DEFAULT_UNIVERSE], now) : [];
    add("movers", moverAlerts(cached.length >= 20 ? cached : await dailyCloses(base, [...DEFAULT_UNIVERSE], now)));
  }
  const refused = fresh.filter((alert) => validateAlert(alert, now).length > 0);
  for (const alert of refused.slice(0, 10)) log(`alerts gate: refused ${alert.id}: ${validateAlert(alert, now).join("; ")}`);
  const alerts = mergeAlerts(previous?.alerts ?? [], fresh, now);
  const payload = {
    meta: { asOf: now.toISOString(), source: "TradeHax alert rules over EDGAR, FINRA, House Clerk, Nasdaq, Cboe and Alpaca data", rows: alerts.length, delay: "about 15 min for the tape, daily for filings", stale: false, unavailable: false },
    sources,
    alerts,
  };
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "alerts.json"), JSON.stringify(payload));
  log(`alerts: ${alerts.length} in feed, ${fresh.length} this run (${Object.entries(sources).map(([key, value]) => `${key} ${value}`).join(", ")}), ${refused.length} refused`);
  return payload;
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "public", "data"));
  const base = (process.env.WORKER_URL ?? "").replace(/\/$/, "");
  await generate({ dataDir, base });
}
