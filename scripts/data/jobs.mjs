import { parseForm4 } from "../../src/lib/datasets/form4.ts";
import { houseParties, parseHouseIndex, parsePtrText, splitDistrict } from "../../src/lib/datasets/congress.ts";
import { parseFtd } from "../../src/lib/datasets/ftd.ts";
import { parseNavHistory } from "../../src/lib/datasets/nav.ts";
import { monthlyReturns } from "../../src/lib/datasets/seasonality.ts";
import { DEFAULT_UNIVERSE } from "../../src/lib/live/universe.ts";
import { appendIvHistory } from "../../src/lib/options/ivrank.ts";
import { oiChanges } from "../../src/lib/datasets/oi.ts";
import { readFile } from "node:fs/promises";
import { loadOptionChain, nearestIv30 } from "./option-chain.mjs";

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

const PTR_WINDOW_DAYS = 120;
const PTR_MAX_DOCS = 160;

function usToIso(value) {
  const [month, day, year] = String(value).split("/");
  return year && month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : String(value);
}

async function houseIndex(year) {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const zip = await grab(`https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.zip`, {}, 20000);
  const dir = mkdtempSync(`${tmpdir()}/house-`);
  try {
    const file = `${dir}/fd.zip`;
    writeFileSync(file, Buffer.from(await zip.arrayBuffer()));
    return parseHouseIndex(execFileSync("unzip", ["-p", file, `${year}FD.txt`], { encoding: "utf8" })).map((row) => ({ ...row, year }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function ptrText(year, docId) {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const response = await grabRetry(`https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${year}/${docId}.pdf`, { headers: { "user-agent": BROWSER, accept: "application/pdf" } }, 20000, 2);
  const dir = mkdtempSync(`${tmpdir()}/ptr-`);
  try {
    const file = `${dir}/${docId}.pdf`;
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    return execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function partyMap() {
  try {
    const response = await grabRetry("https://unitedstates.github.io/congress-legislators/legislators-current.json", {}, 20000, 2);
    return houseParties(await response.json());
  } catch {
    return new Map();
  }
}

/**
 * House periodic transaction reports, parsed into trades. The clerk index lists the
 * filings; each electronically filed PDF goes through pdftotext. Scanned paper filings
 * have no text layer and are counted, not guessed. Parsed documents are reused from the
 * last file so a run only reads new PDFs.
 */
export async function congress() {
  try {
    const now = new Date();
    const years = [now.getUTCFullYear()];
    if (now.getUTCMonth() < 4) years.push(now.getUTCFullYear() - 1);
    const index = (await Promise.all(years.map((year) => houseIndex(year).catch(() => [])))).flat();
    if (index.length === 0) throw new Error("House clerk index did not load");
    const cutoff = new Date(now.getTime() - PTR_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    const filings = index
      .filter((row) => row.filingType === "P")
      .map((row) => ({ ...row, filed: usToIso(row.filed) }))
      .filter((row) => row.filed >= cutoff)
      .sort((a, b) => (a.filed < b.filed ? 1 : -1))
      .slice(0, PTR_MAX_DOCS);

    const prior = await readFile(`${process.env.DATA_DIR ?? "data"}/congress.json`, "utf8").then(JSON.parse).catch(() => null);
    const cache = new Map();
    for (const doc of prior?.docs ?? []) cache.set(String(doc.docId), doc);
    for (const row of prior?.rows ?? []) {
      if (!row?.docId || !row?.ticker) continue;
      const doc = cache.get(String(row.docId));
      if (doc) (doc.trades ??= []).push(row);
    }

    const parties = await partyMap();
    const docs = [];
    const queue = [...filings];
    const worker = async () => {
      while (queue.length) {
        const filing = queue.shift();
        const known = cache.get(filing.docId);
        if (known && known.status !== "error") {
          docs.push({ docId: filing.docId, status: known.status, trades: known.trades ?? [] });
          continue;
        }
        try {
          const text = await ptrText(filing.year, filing.docId);
          const trades = parsePtrText(text);
          const scanned = text.replace(/\s+/g, "").length < 200;
          docs.push({ docId: filing.docId, status: scanned ? "scanned" : "parsed", trades });
        } catch (error) {
          docs.push({ docId: filing.docId, status: "error", error: error instanceof Error ? error.message : String(error), trades: [] });
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    const byDoc = new Map(filings.map((filing) => [filing.docId, filing]));
    const rows = [];
    for (const doc of docs) {
      const filing = byDoc.get(doc.docId);
      if (!filing) continue;
      const { state, district } = splitDistrict(filing.state);
      const party = parties.get(`${state}${district}`) ?? null;
      for (const trade of doc.trades) {
        rows.push({
          ticker: trade.ticker,
          asset: trade.asset,
          assetType: trade.assetType,
          type: trade.type,
          owner: trade.owner,
          transactionDate: trade.transactionDate,
          notifiedDate: trade.notifiedDate,
          amount: trade.amount,
          amountLow: trade.amountLow,
          amountHigh: trade.amountHigh,
          member: filing.name.replace(/^Hon\.\s*/, ""),
          party,
          chamber: "House",
          district: filing.state,
          filed: filing.filed,
          docId: filing.docId,
          url: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${filing.year}/${filing.docId}.pdf`,
        });
      }
    }
    rows.sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : a.transactionDate > b.transactionDate ? -1 : a.member.localeCompare(b.member)));
    const counts = { filings: filings.length, parsed: docs.filter((doc) => doc.status === "parsed").length, scanned: docs.filter((doc) => doc.status === "scanned").length, errors: docs.filter((doc) => doc.status === "error").length };
    if (rows.length === 0) throw new Error(`No trades parsed from ${filings.length} House filings`);
    return {
      ...pack("House Clerk periodic transaction reports", rows, {
        delay: "daily",
        note: `${rows.length.toLocaleString("en-US")} trades parsed from ${counts.parsed} electronic House filings in the last ${PTR_WINDOW_DAYS} days. ${counts.scanned} scanned paper filings have no text and are linked, not parsed.`,
      }),
      counts,
      docs: docs.map((doc) => ({ docId: doc.docId, status: doc.status })),
      filings: filings.map(({ name, state, filed, docId, year }) => ({ name, state, filed, docId, year })),
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
  const sources = new Set();
  let fetched = 0;
  for (const symbol of UNIVERSE) {
    try {
      const body = await loadOptionChain(symbol, { fetcher: fetch, sleep: () => Promise.resolve() });
      fetched += 1;
      if (body?.source) sources.add(body.source);
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
  const feed = sources.size ? [...sources].join(", ") : "Cboe delayed";
  const packed = pack(`${feed} open interest`, rows, {
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
      const body = await loadOptionChain(symbol, { fetcher: fetch, sleep: () => Promise.resolve() });
      const close = body?.data?.current_price;
      const iv30 = typeof body?.data?.iv30 === "number" ? body.data.iv30 : nearestIv30(body?.data?.options, close);
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
  // FINRA returns matches oldest first and cannot sort on settlementDate, so a fixed
  // lower bound plus a small limit froze this file on an old settlement. Use a rolling
  // 90-day window (about six settlements) and keep the latest row.
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  for (const symbol of UNIVERSE) {
    try {
      const response = await grab("https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          compareFilters: [
            { compareType: "EQUAL", fieldName: "symbolCode", fieldValue: symbol },
            { compareType: "GREATER", fieldName: "settlementDate", fieldValue: since },
          ],
          limit: 20,
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

/** Newest-first SEC half-month file names: cnsfails YYYYMM a (1st-15th) and b (16th-end). */
export function ftdCandidates(now = new Date(), count = 4) {
  const names = [];
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  let half = now.getUTCDate() > 15 ? "b" : "a";
  while (names.length < count) {
    names.push(`cnsfails${year}${String(month).padStart(2, "0")}${half}`);
    if (half === "b") half = "a";
    else {
      half = "b";
      month -= 1;
      if (month === 0) { month = 12; year -= 1; }
    }
  }
  return names;
}

export async function ftd() {
  try {
    // The file name used to be hard-coded to October's first half. SEC posts each half
    // a few weeks late, so walk back from the current half until one exists.
    let response = null;
    let picked = null;
    for (const name of ftdCandidates()) {
      try {
        response = await grab(`https://www.sec.gov/files/data/fails-deliver-data/${name}.zip`, {}, 20000);
        picked = name;
        break;
      } catch {
        response = null;
      }
    }
    if (!response) throw new Error("No recent SEC fails-to-deliver file answered.");
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
    const packed = pack("SEC fails-to-deliver", rows, { delay: "about 3 weeks", note: `Half-month file ${picked}, filtered to the liquid universe.` });
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
    // Keyed by symbol, the same shape as public/data/technicals.json, which the screener
    // joins on and the news engine reads for movers and sector rotation.
    const packed = pack(body.source ? `${body.source} via worker` : "worker /v1/technicals", [], { delay: "daily" });
    packed.rows = rows;
    packed.meta.rows = Object.keys(rows).length;
    packed.meta.coverage = 1;
    return packed;
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

export async function macro() {
  const ids = ["DGS3MO", "DGS2", "DGS5", "DGS10", "DGS30", "T10Y2Y", "T10Y3M", "BAMLH0A0HYM2", "DFF", "CPIAUCSL", "UNRATE", "ICSA", "WALCL"];
  const latest = {};
  const errors = [];
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  for (const id of ids) {
    try {
      // FRED stalls requests that carry a browser User-Agent from datacenter IPs, which
      // timed out every series. A plain tool UA answers in well under a second.
      const response = await grabRetry(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${since}`, { headers: { "user-agent": "TradeHaxIntel/1.0 (+https://tradehaxai.tech)" } }, 15000, 2);
      const lines = (await response.text()).trim().split(/\r?\n/);
      const last = lines.at(-1)?.split(",") ?? [];
      const raw = (last[1] ?? "").trim();
      latest[id] = raw === "." || raw === "" ? null : Number(raw);
      if (!Number.isFinite(latest[id])) latest[id] = null;
    } catch (error) {
      latest[id] = null;
      errors.push(`${id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  const packed = pack("FRED public CSV", Object.entries(latest).map(([id, value]) => ({ id, value })), {
    delay: "daily",
    note: `VIX futures CSV is unverified and is left unavailable until a file answers. ${errors.slice(0, 3).join("; ")}`.trim(),
  });
  packed.latest = latest;
  packed.meta.coverage = Object.values(latest).filter((value) => value != null).length / ids.length;
  return packed;
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
  macro,
  "etf-flows": etfFlows,
  screener,
  universe,
  seasonality,
  "flow-history": flowHistory,
  technicals,
};
