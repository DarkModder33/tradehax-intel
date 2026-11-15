import { parseForm4 } from "../../src/lib/datasets/form4.ts";
import { parseHouseIndex } from "../../src/lib/datasets/congress.ts";
import { parseFtd } from "../../src/lib/datasets/ftd.ts";
import { monthlyReturns } from "../../src/lib/datasets/seasonality.ts";

const USER_AGENT = process.env.SEC_USER_AGENT || "TradeHaxIntel admin@tradehax.local";

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
      ...pack("House Clerk PTR index", filings, { delay: "daily", note: "Transaction lines need pdftotext. This file is the filing index. Senate eFD is not included." }),
      senate: { unavailable: true, error: "Senate eFD was under maintenance when this job was written. House filings only." },
    };
  } catch (error) {
    return { ...failed("House Clerk", error), senate: { unavailable: true, error: "Senate eFD unavailable" } };
  }
}

export async function institutions() {
  return failed("SEC 13F", new Error("Quarterly 13F ZIP is not expanded in this run. The job records the miss instead of a partial table."));
}

export async function oiChange() {
  return failed("Cboe open interest", new Error("No prior chain is stored yet, so a change cannot be computed. The next run can diff against a saved baseline."));
}

export async function ivHistory() {
  try {
    const response = await grab("https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json", {}, 20000);
    const body = await response.json();
    const iv30 = body?.data?.iv30 ?? null;
    return pack("Cboe iv30", [{ symbol: "SPY", iv30, asOf: body?.timestamp ?? null }], {
      delay: "about 15 min",
      note: "History building: 1 point. Rank needs 252 sessions.",
    });
  } catch (error) {
    return failed("Cboe iv30", error);
  }
}

export async function shortInterest() {
  try {
    const response = await grab("https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        compareFilters: [
          { compareType: "EQUAL", fieldName: "symbolCode", fieldValue: "AAPL" },
          { compareType: "GREATER", fieldName: "settlementDate", fieldValue: "2026-06-01" },
        ],
        limit: 20,
      }),
    });
    const rows = parseJsonLoose(await response.text());
    const latest = Array.isArray(rows) ? rows.sort((a, b) => String(b.settlementDate).localeCompare(String(a.settlementDate)))[0] : null;
    return pack("FINRA consolidated short interest", latest ? [latest] : [], { delay: "twice monthly", note: "AAPL sample. Float is not in this file, so SI% float is n/a." });
  } catch (error) {
    return failed("FINRA short interest", error);
  }
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
    const rows = parseFtd(text).filter((row) => row.symbol === "SPY" || row.symbol === "AAPL").slice(0, 50);
    return pack("SEC fails-to-deliver", rows, { delay: "about 3 weeks", note: "Half-month file. SPY and AAPL only in this snapshot." });
  } catch (error) {
    return failed("SEC fails-to-deliver", error);
  }
}

export async function ats() {
  try {
    const response = await grab("https://api.finra.org/data/group/otcMarket/name/weeklySummary", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        compareFilters: [
          { compareType: "EQUAL", fieldName: "issueSymbolIdentifier", fieldValue: "AAPL" },
          { compareType: "GREATER", fieldName: "summaryStartDate", fieldValue: "2026-09-01" },
        ],
        limit: 5,
      }),
    });
    const rows = parseJsonLoose(await response.text());
    return pack("FINRA ATS weekly", Array.isArray(rows) ? rows : [], { delay: "2 to 4 weeks" });
  } catch (error) {
    return failed("FINRA ATS", error);
  }
}

export async function calendars() {
  const earnings = await (async () => {
    try {
      const response = await grab("https://api.nasdaq.com/api/calendar/earnings?date=2026-11-13", { headers: { accept: "application/json" } }, 15000);
      const body = await response.json();
      const rows = body?.data?.rows ?? body?.data ?? [];
      return pack("Nasdaq earnings", Array.isArray(rows) ? rows.slice(0, 40) : [], { delay: "daily" });
    } catch (error) {
      return failed("Nasdaq earnings", error);
    }
  })();
  const economic = await (async () => {
    try {
      const response = await grab("https://api.nasdaq.com/api/calendar/economicevents?date=2026-11-13", { headers: { accept: "application/json" } }, 15000);
      const body = await response.json();
      const rows = body?.data?.rows ?? [];
      return pack("Nasdaq economic calendar", Array.isArray(rows) ? rows.slice(0, 40) : [], { delay: "daily" });
    } catch (error) {
      return failed("Nasdaq economic calendar", error);
    }
  })();
  const fomc = failed("Federal Reserve", new Error("No FOMC date list is bundled. The economic calendar is the source when Nasdaq answers."));
  const ipo = failed("Nasdaq IPO", new Error("IPO calendar was not requested in this run."));
  const rows = [
    ...(earnings.rows ?? []).map((row) => ({ kind: "earnings", ...row })),
    ...(economic.rows ?? []).map((row) => ({ kind: "economic", ...row })),
  ];
  const unavailable = Boolean(earnings.meta.unavailable && economic.meta.unavailable);
  return {
    meta: {
      asOf: earnings.meta.asOf ?? economic.meta.asOf,
      source: "Nasdaq calendars",
      rows: rows.length,
      delay: "daily",
      unavailable,
      error: unavailable ? earnings.meta.error : undefined,
    },
    rows,
    parts: { earnings: earnings.meta, economic: economic.meta, fomc: fomc.meta, ipo: ipo.meta },
    note: "FOMC dates are not bundled. IPO was not requested.",
  };
}

export async function etfFlows() {
  return failed("SPDR", new Error("The NAV workbook is xlsx. This run does not expand it, so flows are unavailable rather than estimated."));
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
  try {
    const url = "https://proxy.cors.dev/https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1mo&range=10y";
    const body = await (await grab(url)).json();
    const result = body?.chart?.result?.[0];
    const stamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const points = stamps
      .map((stamp, index) => ({ date: new Date(stamp * 1000).toISOString().slice(0, 10), close: closes[index] }))
      .filter((point) => Number.isFinite(point.close));
    return pack("Yahoo SPY monthly", monthlyReturns(points), { delay: "daily", note: "Month-of-year returns from monthly closes, not a trading system." });
  } catch (error) {
    return failed("Yahoo SPY", error);
  }
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
  "etf-flows": etfFlows,
  screener,
  seasonality,
};
