/**
 * Desk stories: fewer, longer-form market notes. Each one has a headline that says why the
 * number matters, a lede, context (sector, prior moves, levels), a data table, and a
 * "what to watch" list. A story is written only when the inputs carry enough substance;
 * everything else is left to the one-line alert feed.
 *
 * Pure: every input (bars, headlines, files) is passed in, so tests run without a network.
 */
import { DISCLAIMER, validateStory } from "./engine.mjs";

export const DESK_RULES = {
  moverSingle: 0.06,
  moverIndex: 0.025,
  rotationSpread: 0.04,
  earningsGap: 0.02,
  earningsMaxAgeDays: 3,
  gammaMinAbs: 50_000_000,
  flowSpikeRatio: 2.5,
  flowSpikeMinContracts: 250_000,
  minTableRows: 5,
  minWatch: 2,
  minContextFacts: 3,
  cap: 6,
};

export const NAMES = {
  SPY: "The S&P 500 ETF", QQQ: "The Nasdaq 100 ETF", IWM: "The Russell 2000 ETF", DIA: "The Dow ETF", SMH: "The semiconductor ETF",
  GLD: "The gold ETF", TLT: "The long Treasury ETF", HYG: "The high-yield bond ETF",
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "Nvidia", AMZN: "Amazon", GOOGL: "Alphabet", META: "Meta", TSLA: "Tesla", AVGO: "Broadcom",
  BRKB: "Berkshire Hathaway", JPM: "JPMorgan", V: "Visa", UNH: "UnitedHealth", XOM: "Exxon Mobil", LLY: "Eli Lilly", MA: "Mastercard",
  COST: "Costco", HD: "Home Depot", PG: "Procter & Gamble", JNJ: "Johnson & Johnson", BAC: "Bank of America", AMD: "AMD", NFLX: "Netflix",
  CRM: "Salesforce", ORCL: "Oracle", KO: "Coca-Cola", WMT: "Walmart", CVX: "Chevron", MRK: "Merck", ABBV: "AbbVie", PLTR: "Palantir",
  COIN: "Coinbase", MSTR: "Strategy (MSTR)", BA: "Boeing",
};

const MATCH = { ...Object.fromEntries(Object.entries(NAMES).map(([key, value]) => [key, value.replace(/^The /, "")])), GOOGL: "Alphabet|Google", META: "Meta|Facebook", MSTR: "Strategy|MicroStrategy", BRKB: "Berkshire", NVDA: "Nvidia", PG: "Procter" };

export const SECTOR_OF = {
  NVDA: "SMH", AMD: "SMH", AVGO: "SMH", AAPL: "XLK", MSFT: "XLK", ORCL: "XLK", CRM: "XLK", PLTR: "XLK",
  GOOGL: "XLC", META: "XLC", NFLX: "XLC", AMZN: "XLY", TSLA: "XLY", HD: "XLY", JPM: "XLF", BAC: "XLF", V: "XLF", MA: "XLF",
  BRKB: "XLF", COIN: "XLF", UNH: "XLV", LLY: "XLV", JNJ: "XLV", MRK: "XLV", ABBV: "XLV", XOM: "XLE", CVX: "XLE", BA: "XLI",
  COST: "XLY", WMT: "XLY", PG: "XLY", KO: "XLY",
};

export const SECTOR_NAMES = {
  XLK: "technology", XLF: "financials", XLE: "energy", XLV: "health care", XLY: "consumer discretionary", XLI: "industrials",
  XLB: "materials", XLU: "utilities", XLRE: "real estate", XLC: "communication services", XLP: "consumer staples", SMH: "semiconductors",
};

const INDEXES = new Set(["SPY", "QQQ", "IWM", "DIA"]);
const SECTORS = ["XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLB", "XLU", "XLRE", "XLC", "SMH"];

// ---------- formatting ----------
const fin = (value) => (value == null || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);
export const pct = (value, digits = 1) => (value == null ? "n/a" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`);
const absPct = (value, digits = 1) => `${Math.abs(value * 100).toFixed(digits)}%`;
const usd = (value) => (value == null ? "n/a" : `$${value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : value.toFixed(2)}`);
const big = (value) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};
const count = (value) => (value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(0)}K` : String(Math.round(value)));
const times = (value) => `${value.toFixed(1)}x`;
const WEEKDAY = (day) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${day}T12:00:00Z`));
const SHORT = (day) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
const name = (sym) => NAMES[sym] ?? sym;
const nameLower = (sym) => (NAMES[sym]?.startsWith("The ") ? `the ${NAMES[sym].slice(4)}` : name(sym));

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function storyShell({ type, ticker, tickers, day, dataDate, asOf, headline, dek, lede, sections, table, watch, keyNumbers, spark, sources, materiality }) {
  const slug = `${ticker.toLowerCase()}-${type}-${day}`;
  const body = [lede, ...sections.flatMap((section) => section.paragraphs), `What to watch: ${watch.join(" ")}`];
  return {
    id: `${ticker}|${type}|${day}`,
    format: "desk",
    type,
    ticker,
    tickers,
    day,
    dataDate,
    publishedAt: asOf,
    headline,
    dek,
    lede,
    sections,
    table,
    watch,
    body,
    keyNumbers,
    spark,
    sources,
    materiality,
    slug,
    titleSlug: slugify(headline),
    passedMateriality: true,
    disclaimer: DISCLAIMER,
    methodology: "/about/methodology/",
  };
}

/** Substance gate: a story needs a real table, at least two things to watch, and context. */
export function substance(story, rules = DESK_RULES) {
  const reasons = [];
  if (!story.lede || story.lede.split(/\s+/).length < 25) reasons.push("thin lede");
  if ((story.table?.rows?.length ?? 0) < rules.minTableRows) reasons.push("table under minimum rows");
  if ((story.watch?.length ?? 0) < rules.minWatch) reasons.push("not enough to watch");
  const facts = (story.sections ?? []).flatMap((section) => section.paragraphs).join(" ").match(/\d/g)?.length ?? 0;
  if ((story.sections?.length ?? 0) < 1 || facts < rules.minContextFacts) reasons.push("no context");
  if (/\b(NaN|undefined|Infinity|n\/a)\b/.test([story.headline, story.dek, story.lede].join(" "))) reasons.push("placeholder in headline or lede");
  return reasons;
}

// ---------- bars ----------
/** bars: [{ date: "YYYY-MM-DD", close, volume }] oldest first. */
function barStats(bars) {
  const rows = (bars ?? []).filter((bar) => fin(bar.close) > 0);
  if (rows.length < 22) return null;
  const last = rows.at(-1);
  const prev = rows.at(-2);
  const ret1d = last.close / prev.close - 1;
  const vols = rows.slice(-21, -1).map((bar) => fin(bar.volume)).filter((value) => value > 0);
  const avgVol = vols.length ? vols.reduce((sum, value) => sum + value, 0) / vols.length : null;
  const at = (n) => (rows.length > n ? rows.at(-1 - n).close : null);
  const ret5d = at(5) ? last.close / at(5) - 1 : null;
  const prior5 = at(6) ? prev.close / at(6) - 1 : null;
  const ret1m = at(21) ? last.close / at(21) - 1 : null;
  // Largest same-direction daily move before today, to say "biggest since".
  let since = null;
  for (let i = rows.length - 2; i >= 1; i--) {
    const move = rows[i].close / rows[i - 1].close - 1;
    if (Math.sign(move) === Math.sign(ret1d) && Math.abs(move) >= Math.abs(ret1d)) {
      since = rows[i].date;
      break;
    }
  }
  const window = rows.slice(-252);
  const high = Math.max(...window.map((bar) => bar.close));
  const low = Math.min(...window.map((bar) => bar.close));
  const sma = (n) => (rows.length >= n ? rows.slice(-n).reduce((sum, bar) => sum + bar.close, 0) / n : null);
  return {
    date: last.date, close: last.close, prevClose: prev.close, prevDate: prev.date, ret1d, ret5d, prior5, ret1m,
    volRatio: avgVol ? last.volume / avgVol : null, since, sessions: rows.length, high, low, sma50: sma(50), sma200: sma(200),
    spark: rows.slice(-30).map((bar) => bar.close),
  };
}

function relevantHeadline(sym, headlines) {
  const pattern = new RegExp(`\\b(${sym}|${MATCH[sym] ?? sym})\\b`, "i");
  return (headlines?.[sym] ?? []).find((item) => item?.title && pattern.test(item.title) && !/^why .* (stock|shares)/i.test(item.title)) ?? null;
}

// ---------- movers ----------
export function moverCandidates(bars) {
  const out = [];
  for (const [sym, series] of Object.entries(bars ?? {})) {
    if (SECTORS.includes(sym) || ["GLD", "TLT", "HYG"].includes(sym)) continue;
    const stats = barStats(series);
    if (!stats) continue;
    const bar = INDEXES.has(sym) ? DESK_RULES.moverIndex : DESK_RULES.moverSingle;
    if (Math.abs(stats.ret1d) >= bar) out.push({ sym, stats });
  }
  return out.sort((a, b) => Math.abs(b.stats.ret1d) - Math.abs(a.stats.ret1d));
}

function moverStory(sym, stats, input) {
  const up = stats.ret1d > 0;
  const sectorSym = INDEXES.has(sym) ? null : SECTOR_OF[sym];
  const sector = sectorSym ? barStats(input.bars?.[sectorSym]) : null;
  const spy = sym === "SPY" ? null : barStats(input.bars?.SPY);
  const options = input.optionsHistory?.series?.[sym]?.at(-1) ?? null;
  const optionsFresh = options && options.date >= stats.prevDate;
  const news = relevantHeadline(sym, input.headlines);
  const verb = up ? (stats.ret1d >= 0.1 ? "surges" : "jumps") : stats.ret1d <= -0.1 ? "plunges" : "falls";
  // "Nvidia shares surge", "The Nasdaq 100 ETF surges": the plural subject drops the s.
  const sinceDays = stats.since ? Math.round((Date.parse(stats.date) - Date.parse(stats.since)) / 86_400_000) : null;

  // The why, in market terms: record size, then outsized versus its group, then volume.
  let why;
  if (!stats.since && stats.sessions >= 120) why = `its biggest one-day ${up ? "gain" : "drop"} in at least ${Math.floor(stats.sessions / 21)} months`;
  else if (sinceDays != null && sinceDays >= 60) why = `its biggest one-day ${up ? "gain" : "drop"} since ${SHORT(stats.since)}`;
  else if (sector && Math.abs(stats.ret1d - sector.ret1d) >= 0.03) why = `${up ? "outrunning" : "lagging"} ${SECTOR_NAMES[sectorSym]} by ${Math.abs((stats.ret1d - sector.ret1d) * 100).toFixed(0)} points`;
  else if (stats.volRatio && stats.volRatio >= 1.5) why = `on ${times(stats.volRatio)} normal volume`;
  else why = `${up ? "reversing" : "extending"} a ${pct(stats.prior5)} five-session run`;
  const subject = INDEXES.has(sym) || !NAMES[sym] ? name(sym).replace(/^The /, "") : `${name(sym)} shares`;
  const plural = !(INDEXES.has(sym) || !NAMES[sym]);
  const headline = `${subject} ${plural ? verb.replace(/s$/, "") : verb} ${absPct(stats.ret1d)}, ${plural ? why.replace(/^its /, "their ") : why}`;
  // For an index fund, name the single stocks that did the most work.
  const leaders = INDEXES.has(sym)
    ? Object.entries(input.bars ?? {})
      .filter(([other]) => NAMES[other] && !NAMES[other].startsWith("The "))
      .map(([other, series]) => ({ other, stats: barStats(series) }))
      .filter((row) => row.stats && row.stats.date === stats.date && Math.sign(row.stats.ret1d) === Math.sign(stats.ret1d))
      .sort((a, b) => Math.abs(b.stats.ret1d) - Math.abs(a.stats.ret1d))
      .slice(0, 3)
    : [];

  const lede = [
    `${name(sym)}${name(sym).includes(`(${sym})`) ? "" : ` (${sym})`} closed at ${usd(stats.close)} on ${WEEKDAY(stats.date)}, ${up ? "up" : "down"} ${absPct(stats.ret1d)} from ${usd(stats.prevClose)} the session before${stats.volRatio ? `, on volume ${times(stats.volRatio)} its 20-day average` : ""}.`,
    spy ? `The S&P 500 ETF ${spy.ret1d >= 0 ? "rose" : "fell"} ${absPct(spy.ret1d)} on the day.` : "",
    leaders.length ? `Among the large-cap stocks the desk tracks, the biggest ${up ? "gains" : "losses"} came from ${leaders.map((row) => `${name(row.other).replace(/ \(.*\)$/, "")} (${pct(row.stats.ret1d)})`).join(", ")}.` : "",
    news ? `Among the latest headlines on the name, ${news.publisher ?? "the press"} reported: "${news.title.replace(/"/g, "'")}".` : "",
  ].filter(Boolean).join(" ");

  const context = [];
  if (sector) context.push(`Its group, ${SECTOR_NAMES[sectorSym]} (${sectorSym}), ${sector.ret1d >= 0 ? "gained" : "lost"} ${absPct(sector.ret1d)}, so ${sym} moved ${Math.abs((stats.ret1d - sector.ret1d) * 100).toFixed(1)} points ${stats.ret1d - sector.ret1d >= 0 ? "better" : "worse"} than its peers.`);
  if (stats.prior5 != null) context.push(`Coming into the session, ${sym} was ${pct(stats.prior5)} over the prior five days${stats.ret1m != null ? ` and is now ${pct(stats.ret1m)} over the past month` : ""}.`);
  const fromHigh = stats.close / stats.high - 1;
  context.push(fromHigh > -0.005 ? `The close is at the top of its ${Math.min(52, Math.floor(stats.sessions / 5))}-week range.` : `The close sits ${absPct(fromHigh)} below its ${Math.min(52, Math.floor(stats.sessions / 5))}-week closing high of ${usd(stats.high)}.`);
  const levels = [];
  if (stats.sma50) levels.push(`the 50-day average at ${usd(stats.sma50)} (${stats.close >= stats.sma50 ? "above" : "below"} it by ${absPct(stats.close / stats.sma50 - 1)})`);
  if (stats.sma200) levels.push(`the 200-day average at ${usd(stats.sma200)} (${stats.close >= stats.sma200 ? "above" : "below"} by ${absPct(stats.close / stats.sma200 - 1)})`);
  if (levels.length) context.push(`Trend levels: ${levels.join(", and ")}.`);
  const positioning = [];
  if (optionsFresh && fin(options.callVolume) != null && fin(options.putVolume) != null && options.callVolume + options.putVolume >= 200_000) {
    const total = options.callVolume + options.putVolume;
    positioning.push(`Options traded ${count(total)} contracts in the latest stored session, ${Math.round((options.callVolume / total) * 100)}% of them calls.`);
  }
  if (optionsFresh && fin(options.netGex) != null) {
    positioning.push(`Open-interest gamma was ${big(options.netGex)} per 1% move, ${options.netGex < 0 ? "a short-gamma book in which dealer hedging tends to add to moves" : "a long-gamma book in which dealer hedging tends to damp moves"}${fin(options.flip) ? `, with the flip level near ${usd(options.flip)}` : ""}.`);
  }
  const sections = [{ heading: "Context", paragraphs: [context.join(" ")] }];
  if (positioning.length) sections.push({ heading: "Positioning", paragraphs: [positioning.join(" ")] });

  const rows = [
    ["Close", usd(stats.close)],
    ["One-day change", pct(stats.ret1d)],
    ...(stats.volRatio ? [["Volume vs 20-day average", times(stats.volRatio)]] : []),
    ...(sector ? [[`${sectorSym} one-day change`, pct(sector.ret1d)]] : []),
    ...(spy ? [["SPY one-day change", pct(spy.ret1d)]] : []),
    ...(stats.prior5 != null ? [["Prior five sessions", pct(stats.prior5)]] : []),
    ...(stats.ret1m != null ? [["One month", pct(stats.ret1m)]] : []),
    ["Distance from closing high", pct(fromHigh)],
    ...(stats.sma50 ? [["50-day average", usd(stats.sma50)]] : []),
    ...(stats.sma200 ? [["200-day average", usd(stats.sma200)]] : []),
    ...(optionsFresh && fin(options.netGex) != null ? [["Net gamma per 1%", big(options.netGex)]] : []),
    ...(optionsFresh && fin(options.flip) ? [["Gamma flip", usd(options.flip)]] : []),
  ];

  const watch = [];
  watch.push(`Whether ${sym} holds ${up ? "above" : "below"} the prior close of ${usd(stats.prevClose)}: a move back through it would erase the session.`);
  if (stats.volRatio && stats.volRatio >= 1.3) watch.push(`Follow-through volume. Today ran ${times(stats.volRatio)} normal; a quick fade toward average often means the move was a one-day repricing.`);
  if (stats.sma50 && Math.abs(stats.close / stats.sma50 - 1) < 0.08) watch.push(`The 50-day average at ${usd(stats.sma50)}, the nearest trend level.`);
  else if (stats.sma200 && Math.abs(stats.close / stats.sma200 - 1) < 0.1) watch.push(`The 200-day average at ${usd(stats.sma200)}.`);
  if (optionsFresh && fin(options.flip)) watch.push(`The gamma flip near ${usd(options.flip)}: ${stats.close > options.flip ? "a drop below it would put dealers short gamma" : "a move above it would put dealers back to long gamma"}.`);
  if (fromHigh > -0.02) watch.push(`The closing high of ${usd(stats.high)}; a close above it would be a new high for the window.`);

  return storyShell({
    type: "mover",
    ticker: sym,
    tickers: [sym, ...(sectorSym ? [sectorSym] : [])],
    day: stats.date,
    dataDate: stats.date,
    asOf: input.asOf,
    headline,
    dek: `${sym} ${pct(stats.ret1d)} to ${usd(stats.close)}${stats.volRatio ? ` on ${times(stats.volRatio)} volume` : ""}${sector ? `; ${sectorSym} ${pct(sector.ret1d)}` : ""}.`,
    lede,
    sections,
    table: { caption: `${sym} on ${SHORT(stats.date)}`, columns: ["Measure", "Value"], rows },
    watch,
    keyNumbers: [
      { label: "One-day change", value: pct(stats.ret1d), source: "Alpaca SIP daily bars via worker", asOf: stats.date },
      { label: "Close", value: usd(stats.close), source: "Alpaca SIP daily bars via worker", asOf: stats.date },
      ...(stats.volRatio ? [{ label: "Volume vs 20-day average", value: times(stats.volRatio), source: "Alpaca SIP daily bars via worker", asOf: stats.date }] : []),
    ],
    spark: stats.spark,
    sources: [{ name: "Alpaca SIP daily bars via worker", asOf: stats.date }, ...(optionsFresh ? [{ name: "Cboe delayed option chain", asOf: options.date }] : []), ...(news ? [{ name: news.publisher ?? "Yahoo Finance", asOf: input.asOf }] : [])],
    materiality: Math.abs(stats.ret1d) * 1000 + (INDEXES.has(sym) ? 40 : 0),
  });
}

// ---------- sector rotation ----------
function rotationStory(input) {
  const rows = SECTORS.map((sym) => ({ sym, stats: barStats(input.bars?.[sym]) })).filter((row) => row.stats && row.stats.ret5d != null);
  if (rows.length < 6) return null;
  rows.sort((a, b) => b.stats.ret5d - a.stats.ret5d);
  const leader = rows[0];
  const laggard = rows.at(-1);
  const spread = leader.stats.ret5d - laggard.stats.ret5d;
  if (spread < DESK_RULES.rotationSpread) return null;
  const spy = barStats(input.bars?.SPY);
  const day = leader.stats.date;
  const positive = rows.filter((row) => row.stats.ret5d > 0).length;
  const headline = `${SECTOR_NAMES[leader.sym][0].toUpperCase()}${SECTOR_NAMES[leader.sym].slice(1)} leads, ${SECTOR_NAMES[laggard.sym]} lags: a ${(spread * 100).toFixed(1)}-point gap over five sessions`;
  const lede = `${SECTOR_NAMES[leader.sym][0].toUpperCase()}${SECTOR_NAMES[leader.sym].slice(1)} (${leader.sym}) returned ${pct(leader.stats.ret5d)} over the five sessions through ${WEEKDAY(day)}, while ${SECTOR_NAMES[laggard.sym]} (${laggard.sym}) returned ${pct(laggard.stats.ret5d)}. ${positive} of ${rows.length} sector funds finished the window higher${spy?.ret5d != null ? `, against ${pct(spy.ret5d)} for the S&P 500 ETF` : ""}.`;
  const context = `On the latest session alone, ${leader.sym} ${leader.stats.ret1d >= 0 ? "gained" : "lost"} ${absPct(leader.stats.ret1d)} and ${laggard.sym} ${laggard.stats.ret1d >= 0 ? "gained" : "lost"} ${absPct(laggard.stats.ret1d)}. Over one month the order is ${leader.stats.ret1m != null && laggard.stats.ret1m != null ? `${leader.sym} ${pct(leader.stats.ret1m)} and ${laggard.sym} ${pct(laggard.stats.ret1m)}` : "not available for both funds"}, which shows whether this week extends or reverses the month's trend.`;
  const watch = [
    `Whether ${leader.sym} holds above its 50-day average${leader.stats.sma50 ? ` at ${usd(leader.stats.sma50)}` : ""}; leadership that loses its trend line usually rotates out.`,
    `${laggard.sym}${laggard.stats.sma50 ? ` against its 50-day average at ${usd(laggard.stats.sma50)}` : ""}: a laggard that reclaims trend often marks the end of a rotation.`,
    `The spread itself: a gap above ${(spread * 100).toFixed(0)} points next week would confirm the rotation; a narrowing gap would say it was a one-week shake-out.`,
  ];
  return storyShell({
    type: "rotation",
    ticker: "SECTORS",
    tickers: [leader.sym, laggard.sym],
    day,
    dataDate: day,
    asOf: input.asOf,
    headline,
    dek: `${leader.sym} ${pct(leader.stats.ret5d)}, ${laggard.sym} ${pct(laggard.stats.ret5d)} over five sessions; ${positive} of ${rows.length} sectors up.`,
    lede,
    sections: [{ heading: "Context", paragraphs: [context] }],
    table: {
      caption: `Sector ETFs, five sessions through ${SHORT(day)}`,
      columns: ["Sector", "ETF", "1 day", "5 days", "1 month"],
      rows: rows.map((row) => [SECTOR_NAMES[row.sym], row.sym, pct(row.stats.ret1d), pct(row.stats.ret5d), pct(row.stats.ret1m)]),
    },
    watch,
    keyNumbers: [
      { label: `${leader.sym} five-day return`, value: pct(leader.stats.ret5d), source: "Alpaca SIP daily bars via worker", asOf: day },
      { label: `${laggard.sym} five-day return`, value: pct(laggard.stats.ret5d), source: "Alpaca SIP daily bars via worker", asOf: day },
    ],
    spark: leader.stats.spark,
    sources: [{ name: "Alpaca SIP daily bars via worker", asOf: day }],
    materiality: spread * 600,
  });
}

// ---------- earnings ----------
function earningsStory(row, input, today) {
  const sym = String(row.sym ?? "").toUpperCase();
  const realized = fin(row.realized);
  const implied = fin(row.implied);
  if (!sym || realized == null || !(implied > 0)) return null;
  const after = String(row.afterDate ?? "");
  if (!after || Date.parse(`${today}T00:00:00Z`) - Date.parse(`${after}T00:00:00Z`) > DESK_RULES.earningsMaxAgeDays * 86_400_000) return null;
  const gap = Math.abs(realized) - Math.abs(implied);
  if (Math.abs(gap) < DESK_RULES.earningsGap) return null;
  const history = (input.earnings?.rows ?? []).filter((item) => String(item.sym).toUpperCase() === sym && item.reportDate <= row.reportDate).sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1)).slice(0, 5);
  const prior = history.slice(1).filter((item) => fin(item.realized) != null);
  const avgPrior = prior.length ? prior.reduce((sum, item) => sum + Math.abs(item.realized), 0) / prior.length : null;
  const upcoming = (input.earnings?.upcoming ?? []).find((item) => String(item.sym).toUpperCase() === sym);
  const bigger = gap > 0;
  const headline = bigger
    ? `${name(sym).replace(/^The /, "")} moves ${absPct(realized)} on earnings, more than the ${absPct(implied)} options priced`
    : `${name(sym).replace(/^The /, "")} moves just ${absPct(realized)} on earnings, well inside the ${absPct(implied)} options priced`;
  const surprise = fin(row.surprisePct);
  const lede = `${name(sym)} (${sym}) reported on ${SHORT(row.reportDate)}${surprise != null ? ` with earnings per share ${surprise >= 0 ? "beating" : "missing"} the consensus by ${Math.abs(surprise).toFixed(1)}%` : ""}. The stock went from ${usd(fin(row.closeBefore))} at the close on ${SHORT(row.beforeDate)} to ${usd(fin(row.closeAfter))} on ${SHORT(after)}, a ${pct(realized)} move. The at-the-money straddle had priced about ${absPct(implied)} either way, so options sellers ${bigger ? "lost" : "kept"} the premium on this report.`;
  const context = [
    avgPrior != null ? `Over the previous ${prior.length} report${prior.length === 1 ? "" : "s"} on file, ${sym} moved an average of ${absPct(avgPrior)} in absolute terms, so this reaction was ${Math.abs(realized) > avgPrior ? "larger" : "smaller"} than usual.` : "",
    `The move window runs from the close before the report to the first close after it, which captures the reaction whether results came before the open or after the close.`,
  ].filter(Boolean).join(" ");
  const rows = history.map((item) => [SHORT(item.reportDate) + ` ${String(item.reportDate).slice(0, 4)}`, fin(item.implied) ? `±${absPct(item.implied)}` : "n/a", pct(fin(item.realized)), fin(item.surprisePct) != null ? `${item.surprisePct > 0 ? "+" : ""}${Number(item.surprisePct).toFixed(1)}%` : "n/a"]);
  while (rows.length < DESK_RULES.minTableRows && rows.length) break;
  const watch = [
    `Whether ${sym} holds the post-report close of ${usd(fin(row.closeAfter))}; reactions inside the implied move often drift back toward the pre-report level of ${usd(fin(row.closeBefore))}.`,
    upcoming?.reportDate ? `The next report, listed for ${SHORT(upcoming.reportDate)}${fin(upcoming.implied) ? `, where options currently price ±${absPct(upcoming.implied)}` : ""}.` : `Implied volatility after the report: with the event passed, the next straddle should price a smaller move.`,
    avgPrior != null ? `Whether the next implied move adjusts toward the ${absPct(avgPrior)} average reaction.` : "",
  ].filter(Boolean);
  const story = storyShell({
    type: "earnings",
    ticker: sym,
    tickers: [sym],
    day: row.reportDate,
    dataDate: after,
    asOf: input.asOf,
    headline,
    dek: `${sym} ${pct(realized)} after its ${SHORT(row.reportDate)} report versus a ±${absPct(implied)} implied move.`,
    lede,
    sections: [{ heading: "Context", paragraphs: [context] }],
    table: { caption: `${sym} earnings reactions`, columns: ["Report", "Implied", "Actual", "EPS surprise"], rows },
    watch,
    keyNumbers: [
      { label: "Actual move", value: pct(realized), source: "Alpaca SIP closes", asOf: after },
      { label: "Implied move", value: `±${absPct(implied)}`, source: row.impliedSource ?? "ATM straddle", asOf: row.beforeDate },
    ],
    spark: history.map((item) => Math.abs(fin(item.realized) ?? 0) * 100).reverse(),
    sources: [{ name: "Nasdaq report dates and EPS", asOf: row.reportDate }, { name: row.impliedSource ?? "ATM straddle", asOf: row.beforeDate }, { name: "Alpaca SIP closes", asOf: after }],
    materiality: Math.abs(gap) * 1000,
  });
  // Fewer than four prior reports on file still makes a usable table; relax the row gate to 3.
  story.minRows = 3;
  return story;
}

// ---------- options positioning (gamma flip or volume spike) ----------
function optionsStory(sym, rows, input) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const today = rows.at(-1);
  const before = rows.at(-2);
  const prevGex = fin(before.netGex);
  const nextGex = fin(today.netGex);
  const flipped = prevGex != null && nextGex != null && Math.sign(prevGex) !== Math.sign(nextGex) && Math.abs(prevGex) >= DESK_RULES.gammaMinAbs && Math.abs(nextGex) >= DESK_RULES.gammaMinAbs;
  const total = (row) => (fin(row.callVolume) ?? 0) + (fin(row.putVolume) ?? 0);
  const prior = rows.slice(0, -1).slice(-20).map(total).filter((value) => value > 0).sort((a, b) => a - b);
  const median = prior.length >= 5 ? prior[Math.floor(prior.length / 2)] : null;
  const ratio = median ? total(today) / median : null;
  const spike = ratio != null && ratio >= DESK_RULES.flowSpikeRatio && total(today) >= DESK_RULES.flowSpikeMinContracts;
  if (!flipped && !spike) return null;
  const spot = fin(today.spot);
  const flip = fin(today.flip);
  const callShare = total(today) ? fin(today.callVolume) / total(today) : null;
  const headline = flipped
    ? `${name(sym).replace(/^The /, "")} dealers flip to ${nextGex < 0 ? "short" : "long"} gamma${flip ? ` with the flip at ${usd(flip)}` : ""}${nextGex < 0 ? ", a setup that can widen swings" : ", a setup that tends to calm swings"}`
    : `${name(sym).replace(/^The /, "")} options trade ${times(ratio)} normal volume, ${callShare >= 0.6 ? "led by calls" : callShare <= 0.4 ? "led by puts" : "split between calls and puts"}`;
  const lede = flipped
    ? `Estimated dealer gamma in ${nameLower(sym)} (${sym}) moved from ${big(prevGex)} to ${big(nextGex)} per 1% move between ${SHORT(before.date)} and ${SHORT(today.date)}, with spot at ${usd(spot)}. ${nextGex < 0 ? "In a short-gamma book, dealers hedge by selling into declines and buying into rallies, which tends to add to intraday moves." : "In a long-gamma book, dealers hedge against the move, buying dips and selling rips, which tends to compress ranges."}`
    : `${count(total(today))} ${sym} option contracts traded on ${SHORT(today.date)}, ${times(ratio)} the median of the prior ${prior.length} sessions, with calls ${Math.round((callShare ?? 0) * 100)}% of the total. Spot closed the session near ${usd(spot)}.`;
  const context = [
    flip ? `The flip level, where repriced net gamma crosses zero, is ${usd(flip)}, ${spot ? `${absPct(spot / flip - 1)} ${spot >= flip ? "below" : "above"} spot` : ""}.` : "",
    `Premium split in the session: ${big(fin(today.callPremium) ?? 0)} in calls and ${big(fin(today.putPremium) ?? 0)} in puts.`,
    "Gamma here uses the naive open-interest convention (calls dealer-long, puts dealer-short), so it is an estimate of positioning, not a measurement.",
  ].filter(Boolean).join(" ");
  const tableRows = rows.slice(-6).reverse().map((row) => [SHORT(row.date), usd(fin(row.spot)), fin(row.netGex) != null ? big(row.netGex) : "n/a", fin(row.flip) ? usd(row.flip) : "none", count(total(row))]);
  const watch = [
    flip ? `${usd(flip)}: ${spot >= flip ? "a close below" : "a close above"} the flip would change the hedging regime again.` : "Whether the book re-crosses zero next session; a flip that holds two sessions is more meaningful than one.",
    `Realized range: ${nextGex != null && nextGex < 0 ? "short gamma usually shows up as wider intraday ranges within a day or two" : "long gamma usually shows up as tighter ranges and mean reversion"}.`,
    spike ? `Open interest tomorrow: if the ${count(total(today))} contracts were opening trades, open interest will rise; if not, the spike was positions closing.` : `Option volume relative to its ${prior.length}-session median${median ? ` of ${count(median)} contracts` : ""}.`,
  ];
  return storyShell({
    type: flipped ? "gamma" : "flow",
    ticker: sym,
    tickers: [sym],
    day: today.date,
    dataDate: today.date,
    asOf: input.asOf,
    headline,
    dek: flipped ? `${sym} net gamma ${big(prevGex)} to ${big(nextGex)} per 1%${flip ? `; flip ${usd(flip)}, spot ${usd(spot)}` : ""}.` : `${sym} ${count(total(today))} contracts, ${times(ratio)} the median; calls ${Math.round((callShare ?? 0) * 100)}%.`,
    lede,
    sections: [{ heading: "Context", paragraphs: [context] }],
    table: { caption: `${sym} options, last six sessions`, columns: ["Session", "Spot", "Net gamma / 1%", "Flip", "Contracts"], rows: tableRows },
    watch,
    keyNumbers: [
      { label: "Net gamma per 1%", value: nextGex != null ? big(nextGex) : "n/a", source: "Cboe delayed option chain", asOf: today.date },
      ...(spike ? [{ label: "Volume vs median", value: times(ratio), source: "Cboe delayed option chain", asOf: today.date }] : []),
    ],
    spark: rows.slice(-20).map((row) => fin(row.netGex) ?? 0),
    sources: [{ name: "Cboe delayed option chain", asOf: today.date }],
    materiality: (flipped ? 60 : 30) + (ratio ?? 0) * 5 + (INDEXES.has(sym) ? 20 : 0),
  });
}

/** All desk stories that pass both the substance gate and the shared validation gate. */
export function buildDeskStories(input, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const log = options.log ?? (() => {});
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const ctx = { ...input, asOf: input.asOf ?? now.toISOString() };
  const all = [];
  for (const { sym, stats } of moverCandidates(ctx.bars).slice(0, 6)) all.push(moverStory(sym, stats, ctx));
  all.push(rotationStory(ctx));
  for (const row of ctx.earnings?.rows ?? []) all.push(earningsStory(row, ctx, today));
  for (const [sym, rows] of Object.entries(ctx.optionsHistory?.series ?? {})) all.push(optionsStory(sym, rows, ctx));
  const kept = [];
  for (const story of all.filter(Boolean)) {
    const reasons = [...substance(story, { ...DESK_RULES, minTableRows: story.minRows ?? DESK_RULES.minTableRows }), ...validateStory(story, now)];
    delete story.minRows;
    if (reasons.length) {
      log(`desk gate: refused ${story.id}: ${reasons.join("; ")}`);
      continue;
    }
    kept.push(story);
  }
  return kept.sort((a, b) => b.materiality - a.materiality).slice(0, options.cap ?? DESK_RULES.cap);
}

/** Tickers worth fetching headlines for, before stories are built. */
export function headlineTickers(bars) {
  return moverCandidates(bars).slice(0, 6).map((row) => row.sym);
}
