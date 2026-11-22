import { parseForm4 } from "../../src/lib/datasets/form4.ts";
import { parseHouseIndex } from "../../src/lib/datasets/congress.ts";
import { parseFtd } from "../../src/lib/datasets/ftd.ts";
import { parseNavHistory } from "../../src/lib/datasets/nav.ts";
import { monthlyReturns } from "../../src/lib/datasets/seasonality.ts";
import { DEFAULT_UNIVERSE } from "../../src/lib/live/universe.ts";
import { appendIvHistory } from "../../src/lib/options/ivrank.ts";
import { oiChanges } from "../../src/lib/datasets/oi.ts";
import { readFile } from "node:fs/promises";

const USER_AGENT = process.env.SEC_USER_AGENT || "TradeHaxIntel admin@tradehax.local";
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function secUserAgent() {
  return USER_AGENT;
}

async function grab(url, options = {}, timeoutMs = 20000) {
  const response = await fetch(url, {
    ...options,
    headers: { "user-agent": USER_AGENT, accept: "application/json,text/plain,*/*", ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

async function grabRetry(url, options = {}, timeoutMs = 45000, attempts = 3) {
  let last = new Error(`No attempt for ${url}`);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await grab(url, options, timeoutMs);
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw last;
}

function recentWeekdays(count = 4) {
  const dates = [];
  const cursor = new Date();
  while (dates.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const day = String(cursor.getUTCDate()).padStart(2, "0");
      dates.push(`${cursor.getUTCFullYear()}-${month}-${day}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

function parseJsonLoose(text) {
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error(text.slice(0, 120));
  let depth = 0;
  let string = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (string) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') string = false;
      continue;
    }
    if (char === '"') string = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  return JSON.parse(text.slice(start));
}

function pack(source, rows, extra = {}) {
  return {
    meta: {
      asOf: new Date().toISOString(),
      source,
      rows: rows.length,
      delay: extra.delay ?? "daily",
      stale: false,
      unavailable: false,
    },
    rows,
    note: extra.note ?? "",
  };
}

function failed(source, error) {
  return {
    meta: { asOf: null, source, rows: 0, delay: "n/a", unavailable: true, stale: true, error: String(error.message ?? error) },
    rows: [],
    note: "Kept unavailable because the source failed. Yesterday's file is left in place when this runs again.",
  };
}

export async function insiders() {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 4 * 86400000);
    const url = `https://efts.sec.gov/LATEST/search-index?forms=4&dateRange=custom&startdt=${start.toISOString().slice(0, 10)}&enddt=${end.toISOString().slice(0, 10)}`;
    const body = await (await grab(url)).json();
    const hits = body?.hits?.hits ?? [];
    const rows = [];
    for (const hit of hits.slice(0, 25)) {
      const source = hit._source ?? {};
      const id = String(hit._id ?? "");
      const accession = id.split(":")[0];
      const file = id.split(":")[1];
      const cik = String(source.ciks?.[0] ?? "").replace(/^0+/, "");
      let trade = null;
      if (cik && accession && file) {
        const folder = accession.replace(/-/g, "");
        try {
          const xml = await (await grab(`https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/${file}`, {}, 12000)).text();
          trade = parseForm4(xml);
        } catch {
          trade = null;
        }
      }
      rows.push({
        id,
        filed: source.period_ending ?? null,
        names: source.display_names ?? [],
        trade,
      });
    }
    return pack("SEC EDGAR Form 4", rows, { delay: "hours", note: "Fair-access User-Agent. XML parse is best effort." });
  } catch (error) {
    return failed("SEC EDGAR Form 4", error);
  }
}

async function senateNote() {
  try {
    const response = await grabRetry("https://efdsearch.senate.gov/search/", {
      headers: { "user-agent": BROWSER, accept: "text/html" },
    }, 20000, 3);
    const text = await response.text();
    if (/maintenance/i.test(text)) return "Senate eFD still says the site is under maintenance.";
    return "Senate eFD answered, but the report table needs the agreement cookie. Rows were not parsed.";
  } catch (error) {
    return error instanceof Error ? error.message : "Senate eFD did not answer.";
  }
}

export async function congress() {
  try {
    const zip = await grab("https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2026FD.zip", {}, 20000);
    const bytes = Buffer.from(await zip.arrayBuffer());
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/house-`);
    const file = `${dir}/fd.zip`;
    writeFileSync(file, bytes);
    const text = execFileSync("unzip", ["-p", file, "2026FD.txt"], { encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    const filings = parseHouseIndex(text).filter((row) => row.filingType === "P").slice(-40);
    return {
      ...pack("House Clerk PTR index", filings, { delay: "daily", note: "Transaction lines need pdftotext. This file is the filing index." }),
      senate: { unavailable: true, error: await senateNote() },
    };
  } catch (error) {
    return { ...failed("House Clerk", error), senate: { unavailable: true, error: "Senate eFD unavailable" } };
  }
}

export async function institutions() {
  try {
    const end = new Date().toISOString().slice(0, 10);
    const url = `https://efts.sec.gov/LATEST/search-index?forms=13F-HR&dateRange=custom&startdt=2026-08-01&enddt=${end}`;
    const body = parseJsonLoose(await (await grabRetry(url, {}, 30000, 3)).text());
    const hits = body?.hits?.hits ?? [];
    const rows = hits.slice(0, 20).map((hit) => ({
      id: hit._id ?? "",
      filed: hit._source?.period_ending ?? hit._source?.file_date ?? null,
      names: hit._source?.display_names ?? [],
    }));
    if (!rows.length) return failed("SEC 13F-HR", new Error("The full-text index returned no 13F-HR hits. The quarterly ZIP is not expanded."));
    return pack("SEC 13F-HR index", rows, { delay: "quarterly", note: "Filing index only. Holdings tables inside the quarterly ZIP are not expanded." });
  } catch (error) {
    return failed("SEC 13F", error);
  }
}

export async function oiChange() {
  const priorFile = await readPrior("oi-snapshot.json");
  const previous = priorFile?.snapshot && typeof priorFile.snapshot === "object" ? priorFile.snapshot : {};
  const current = [];
  const snapshot = {};
  let fetched = 0;
  for (const symbol of UNIVERSE) {
    try {
      const response = await grab(`https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`, {}, 20000);
      const body = await response.json();
      fetched += 1;
      for (const option of body?.data?.options ?? []) {
        const occ = option?.option;
        const openInterest = Number(option?.open_interest);
        if (!occ || !Number.isFinite(openInterest)) continue;
        snapshot[occ] = openInterest;
        current.push({ symbol: occ, openInterest });
      }
    } catch {
      // A missing chain stays out of the snapshot. It is not filled with zero.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const priorRows = Object.entries(previous).map(([symbol, openInterest]) => ({ symbol, openInterest: Number(openInterest) }));
  const rows = priorRows.length ? oiChanges(priorRows, current).slice(0, 500) : [];
  const packed = pack("Cboe open interest", rows, {
    delay: "daily",
    note: priorRows.length ? `${rows.length} contracts changed.` : "Baseline stored. A change is computed on the next run.",
  });
  packed.snapshot = snapshot;
  packed.meta.coverage = UNIVERSE.length ? fetched / UNIVERSE.length : 0;
  packed.meta.unavailable = fetched === 0;
  return packed;
}

export const UNIVERSE = [...DEFAULT_UNIVERSE];

async function readPrior(name) {
  const dir = process.env.PREV_DIR;
  if (!dir) return null;
  try {
    return JSON.parse(await readFile(`${dir.replace(/\/$/, "")}/${name}`, "utf8"));
  } catch {
    return null;
  }
}

export async function ivHistory() {
  const prior = await readPrior("iv-history.json");
  const date = new Date().toISOString().slice(0, 10);
  const updates = [];
  const errors = [];
  for (const symbol of UNIVERSE) {
    try {
      const response = await grab(`https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`, {}, 20000);
      const body = await response.json();
      const iv30 = body?.data?.iv30;
      const close = body?.data?.current_price;
      if (typeof iv30 === "number") {
        updates.push({ sym: symbol, date, iv30, close: typeof close === "number" ? close : null, asOf: body?.timestamp ?? null });
      }
    } catch (error) {
      errors.push(`${symbol}: ${error instanceof Error ? error.message : error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (!updates.length) return failed("Cboe iv30", new Error(errors[0] ?? "No iv30 values came back."));
  const history = appendIvHistory(prior?.series ?? prior, updates.map(({ sym, date: session, iv30, close }) => ({ sym, date: session, iv30, close })));
  const packed = pack("Cboe iv30", updates.map((row) => ({ symbol: row.sym, iv30: row.iv30, close: row.close, asOf: row.asOf })), {
    delay: "about 15 min",
    note: `Universe ${updates.length}/${UNIVERSE.length}. Rank stays blank until 20 stored sessions. ${errors.length ? errors.slice(0, 3).join("; ") : ""}`.trim(),
  });
  packed.history = { series: history };
  packed.meta.coverage = updates.length / UNIVERSE.length;
  return packed;
}

export async function shortInterest() {
  const rows = [];
  const errors = [];
  for (const symbol of UNIVERSE) {
    try {
      const response = await grab("https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          compareFilters: [
            { compareType: "EQUAL", fieldName: "symbolCode", fieldValue: symbol },
            { compareType: "GREATER", fieldName: "settlementDate", fieldValue: "2026-06-01" },
          ],
          limit: 5,
        }),
      }, 20000);
      const parsed = parseJsonLoose(await response.text());
      const latest = Array.isArray(parsed) ? parsed.sort((a, b) => String(b.settlementDate).localeCompare(String(a.settlementDate)))[0] : null;
      if (latest) rows.push(latest);
    } catch (error) {
      errors.push(`${symbol}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!rows.length) return failed("FINRA short interest", new Error(errors[0] ?? "No short-interest rows."));
  const packed = pack("FINRA consolidated short interest", rows, { delay: "twice monthly", note: "Float is not in this file, so SI% float stays blank. " + errors.slice(0, 2).join("; ") });
  packed.meta.coverage = rows.length / UNIVERSE.length;
  return packed;
}

export async function ftd() {
  try {
    const response = await grab("https://www.sec.gov/files/data/fails-deliver-data/cnsfails202610a.zip", {}, 20000);
    const bytes = Buffer.from(await response.arrayBuffer());
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/ftd-`);
    const file = `${dir}/ftd.zip`;
    writeFileSync(file, bytes);
    const listing = execFileSync("unzip", ["-l", file], { encoding: "utf8" });
    const name = listing.split("\n").map((line) => line.trim().split(/\s+/).pop()).find((item) => item && item.endsWith(".txt"));
    const text = name ? execFileSync("unzip", ["-p", file, name], { encoding: "utf8", maxBuffer: 20_000_000 }) : "";
    rmSync(dir, { recursive: true, force: true });
    const universe = new Set(UNIVERSE);
    const rows = parseFtd(text).filter((row) => universe.has(row.symbol));
    const packed = pack("SEC fails-to-deliver", rows, { delay: "about 3 weeks", note: "Half-month file, filtered to the liquid universe." });
    packed.meta.coverage = UNIVERSE.length ? new Set(rows.map((row) => row.symbol)).size / UNIVERSE.length : 0;
    return packed;
  } catch (error) {
    return failed("SEC fails-to-deliver", error);
  }
}

export async function ats() {
  const rows = [];
  const errors = [];
  for (const symbol of UNIVERSE) {
    try {
      const response = await grab("https://api.finra.org/data/group/otcMarket/name/weeklySummary", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          compareFilters: [
            { compareType: "EQUAL", fieldName: "issueSymbolIdentifier", fieldValue: symbol },
            { compareType: "GREATER", fieldName: "summaryStartDate", fieldValue: "2026-09-01" },
          ],
          limit: 2,
        }),
      }, 20000);
      const parsed = parseJsonLoose(await response.text());
      if (Array.isArray(parsed)) rows.push(...parsed.map((row) => ({ symbol, ...row })));
    } catch (error) {
      errors.push(`${symbol}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!rows.length) return failed("FINRA ATS", new Error(errors[0] ?? "No ATS rows."));
  const packed = pack("FINRA ATS weekly", rows, { delay: "2 to 4 weeks", note: errors.slice(0, 2).join("; ") });
  packed.meta.coverage = new Set(rows.map((row) => row.symbol)).size / UNIVERSE.length;
  return packed;
}

async function nasdaqCalendar(path) {
  const browser = {
    headers: {
      "user-agent": BROWSER,
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://www.nasdaq.com/",
    },
  };
  let last = new Error(`Nasdaq ${path} did not answer`);
  for (const date of recentWeekdays(4)) {
    try {
      const response = await grabRetry(`https://api.nasdaq.com/api/${path}?date=${date}`, browser, 45000, 3);
      const body = parseJsonLoose(await response.text());
      const rows = body?.data?.rows ?? (Array.isArray(body?.data) ? body.data : []);
      if (Array.isArray(rows) && rows.length) {
        return pack(`Nasdaq ${path}`, rows.slice(0, 40).map((row) => ({ date, ...row })), { delay: "daily" });
      }
      last = new Error(`Nasdaq ${path} returned no rows for ${date}`);
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (process.env.FINNHUB_KEY && path === "calendar/earnings") {
    try {
      const dates = recentWeekdays(4);
      const response = await grabRetry(
        `https://finnhub.io/api/v1/calendar/earnings?from=${dates.at(-1)}&to=${dates[0]}&token=${process.env.FINNHUB_KEY}`,
        {},
        30000,
        2,
      );
      const body = parseJsonLoose(await response.text());
      const rows = body?.earningsCalendar ?? [];
      if (Array.isArray(rows) && rows.length) {
        return pack("Finnhub earnings", rows.slice(0, 40), { delay: "daily", note: "Nasdaq did not answer. Finnhub is the fallback." });
      }
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
    }
  }
  return failed(`Nasdaq ${path}`, last);
}

export async function calendars() {
  const earnings = await nasdaqCalendar("calendar/earnings");
  const economic = await nasdaqCalendar("calendar/economicevents");
  const ipo = await nasdaqCalendar("ipo/calendar");
  const fomc = failed("Federal Reserve", new Error("No FOMC date list is bundled. The economic calendar is the source when Nasdaq answers."));
  const rows = [
    ...(earnings.rows ?? []).map((row) => ({ kind: "earnings", ...row })),
    ...(economic.rows ?? []).map((row) => ({ kind: "economic", ...row })),
    ...(ipo.rows ?? []).map((row) => ({ kind: "ipo", ...row })),
  ];
  const unavailable = rows.length === 0;
  return {
    meta: {
      asOf: earnings.meta.asOf ?? economic.meta.asOf ?? ipo.meta.asOf ?? null,
      source: "Nasdaq calendars",
      rows: rows.length,
      delay: "daily",
      unavailable,
      error: unavailable ? earnings.meta.error : undefined,
    },
    rows,
    parts: { earnings: earnings.meta, economic: economic.meta, fomc: fomc.meta, ipo: ipo.meta },
    note: "FOMC dates are not bundled. Earnings fall back to Finnhub when FINNHUB_KEY is set and Nasdaq times out.",
  };
}

export async function etfFlows() {
  try {
    const response = await grabRetry(
      "https://www.ssga.com/library-content/products/fund-data/etfs/us/navhist-us-en-spy.xlsx",
      { headers: { "user-agent": BROWSER, accept: "*/*", referer: "https://www.ssga.com/" } },
      45000,
      3,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/spy-nav-`);
    const file = `${dir}/spy.xlsx`;
    writeFileSync(file, bytes);
    const shared = execFileSync("unzip", ["-p", file, "xl/sharedStrings.xml"], { encoding: "utf8", maxBuffer: 20_000_000 });
    const sheet = execFileSync("unzip", ["-p", file, "xl/worksheets/sheet1.xml"], { encoding: "utf8", maxBuffer: 40_000_000 });
    rmSync(dir, { recursive: true, force: true });
    const days = parseNavHistory(shared, sheet).slice(0, 20);
    if (!days.length) return failed("SPDR", new Error("NAV workbook had no dated rows."));
    const packed = pack("SPDR NAV history", days.map((day) => ({ symbol: "SPY", ...day })), {
      delay: "daily",
      note: "Flow is the change in shares outstanding times that day's NAV. Sector workbooks are not on this URL, so only SPY is stored. Coverage is partial.",
    });
    packed.meta.coverage = 1 / 12;
    return packed;
  } catch (error) {
    return failed("SPDR", error);
  }
}

export async function universe() {
  try {
    const response = await grabRetry(
      "https://api.nasdaq.com/api/screener/stocks?tableonly=true&download=true",
      { headers: { "user-agent": BROWSER, accept: "application/json", referer: "https://www.nasdaq.com/" } },
      45000,
      3,
    );
    const body = parseJsonLoose(await response.text());
    const rows = (body?.data?.rows ?? [])
      .map((row) => {
        const mcap = Number(String(row.marketCap ?? "").replace(/[$,]/g, ""));
        const price = Number(String(row.lastsale ?? "").replace(/[$,]/g, ""));
        const change = Number(String(row.pctchange ?? "").replace(/%/g, "").replace(/^\+/, ""));
        const volume = Number(String(row.volume ?? "").replace(/,/g, ""));
        return {
          symbol: row.symbol,
          name: row.name ?? row.symbol,
          sector: row.sector || null,
          industry: row.industry || null,
          mcap: Number.isFinite(mcap) ? mcap : null,
          price: Number.isFinite(price) ? price : null,
          change: Number.isFinite(change) ? change : null,
          volume: Number.isFinite(volume) ? volume : null,
        };
      })
      .filter((row) => row.symbol && row.mcap != null && row.mcap >= 300_000_000);
    if (!rows.length) return failed("Nasdaq screener", new Error("No names at or above a $300M market cap."));
    const packed = pack("Nasdaq screener", rows, { delay: "daily", note: "Market cap at least $300M." });
    packed.meta.coverage = 1;
    return packed;
  } catch (error) {
    return failed("Nasdaq screener", error);
  }
}

export async function technicals() {
  const base = process.env.WORKER_URL;
  if (!base) return failed("worker technicals", new Error("WORKER_URL is not set. The liquid-universe snapshot shipped with the site stays in place until this job succeeds."));
  try {
    const response = await grabRetry(`${base.replace(/\/$/, "")}/v1/technicals`, {}, 60000, 2);
    const body = parseJsonLoose(await response.text());
    const rows = body.rows && typeof body.rows === "object" ? body.rows : {};
    if (!Object.keys(rows).length) return failed("worker technicals", new Error(body.error ?? "The worker returned no technicals."));
    return pack("worker /v1/technicals", Object.entries(rows).map(([symbol, stats]) => ({ symbol, ...stats })), { delay: "daily" });
  } catch (error) {
    return failed("worker technicals", error);
  }
}

export async function screener() {
  try {
    const url = "https://proxy.cors.dev/https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=25";
    const body = await (await grab(url)).json();
    const quotes = body?.finance?.result?.[0]?.quotes ?? [];
    const rows = quotes.map((quote) => ({
      symbol: quote.symbol,
      price: quote.regularMarketPrice ?? null,
      change: quote.regularMarketChangePercent ?? null,
      volume: quote.regularMarketVolume ?? null,
      name: quote.shortName ?? quote.symbol,
    }));
    return pack("Yahoo most actives", rows, { delay: "delayed", note: "A predefined list, not the full nightly universe." });
  } catch (error) {
    return failed("Yahoo screener", error);
  }
}

export async function seasonality() {
  const symbols = ["SPY", "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC"];
  const rows = [];
  const errors = [];
  for (const symbol of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1mo&range=10y`;
      const body = await (await grab(url, { headers: { "user-agent": BROWSER } })).json();
      const result = body?.chart?.result?.[0];
      const stamps = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const points = stamps
        .map((stamp, index) => ({ date: new Date(stamp * 1000).toISOString().slice(0, 10), close: closes[index] }))
        .filter((point) => Number.isFinite(point.close));
      rows.push(...monthlyReturns(points).map((row) => ({ symbol, ...row })));
    } catch (error) {
      errors.push(`${symbol}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!rows.length) return failed("Yahoo monthly", new Error(errors[0] ?? "No monthly closes."));
  const packed = pack("Yahoo monthly closes", rows, { delay: "daily", note: "Month-of-year returns from monthly closes, not a trading system. " + errors.slice(0, 2).join("; ") });
  packed.meta.coverage = new Set(rows.map((row) => row.symbol)).size / symbols.length;
  return packed;
}

export async function flowHistory() {
  const base = process.env.WORKER_URL;
  if (!base) return failed("worker history", new Error("WORKER_URL is not set, so /v1/history was not pulled."));
  try {
    const response = await grabRetry(`${base.replace(/\/$/, "")}/v1/history`, {}, 30000, 2);
    const body = parseJsonLoose(await response.text());
    const rows = Array.isArray(body.prints) ? body.prints : [];
    return pack("worker /v1/history", rows.slice(0, 2000), { delay: "about 15 min", note: "Compact snapshot of prints still in worker memory. Empty until the new worker is deployed." });
  } catch (error) {
    return failed("worker history", error);
  }
}

export async function earningsMoves() {
  const prior = await readPrior("earnings-moves.json");
  const rows = Array.isArray(prior?.rows) ? prior.rows : [];
  const packed = pack("Cboe straddle vs later close", rows, {
    delay: "daily",
    note: "Building. Upcoming implied moves are stored when a calendar row and a Cboe chain both answer. Past implied moves are not invented. Nasdaq earnings-surprise is unverified and is not used to fill implied history.",
  });
  packed.meta.unavailable = false;
  return packed;
}

export const JOBS = {
  insiders,
  congress,
  institutions,
  "oi-change": oiChange,
  iv: ivHistory,
  shorts: shortInterest,
  ftd,
  ats,
  calendar: calendars,
  "earnings-moves": earningsMoves,
  "etf-flows": etfFlows,
  screener,
  universe,
  seasonality,
  "flow-history": flowHistory,
};
