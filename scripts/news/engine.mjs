/** Deterministic stories from stored datasets. No model, and no number that is not in the input. */

export const DISCLAIMER = "Auto-generated from market data — not investment advice.";

export const THRESHOLDS = {
  moverAbs: 0.08,
  moverMild: 0.05,
  moverRvol: 1.5,
  rotationSpread: 0.04,
  shortChange: 10,
  shortDays: 5,
  ftdNotional: 20_000_000,
  insiderOwners: 2,
  oiChangeAbs: 500,
  oiChangeFrac: 0.25,
  earningsGap: 0.02,
  macroPoints: 0.1,
  ivRankHigh: 0.9,
  ivRankLow: 0.1,
  cap: 10,
  perType: 3,
  staleShortDays: 45,
  flowSpikeRatio: 2.5,
  flowSpikeMinContracts: 250_000,
  flowSpikeMinSessions: 5,
  gammaMinAbs: 50_000_000,
  insiderWindowDays: 14,
  inputMaxAgeHours: 36,
};

/** Days a story's underlying data may age before it is no longer news, by type. */
export const STALE_DAYS = { mover: 4, rotation: 4, short: 45, ftd: 60, insider: 21, unusual: 4, earnings: 10, macro: 10, iv: 4, flow: 3, gamma: 3 };

const SECTORS = ["XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLB", "XLU", "XLRE", "XLC", "XLP"];
const BENCHMARKS = new Set(["SPY", "QQQ", "IWM", "DIA", "GLD", "TLT", "HYG", "SMH", ...SECTORS]);

const OPENERS = {
  mover: [
    (f) => `${f.ticker} moved ${f.ret5} across five stored sessions, which is large enough to clear the desk filter.`,
    (f) => `Five daily closes left ${f.ticker} ${f.ret5} from where that window started.`,
    (f) => `The latest technicals file puts ${f.ticker} at ${f.ret5} over five sessions, ahead of the usual noise band.`,
  ],
  rotation: [
    (f) => `${f.leader} led the sector ETFs over five sessions and ${f.laggard} lagged, a gap of ${f.spread}.`,
    (f) => `Sector ETFs split this window: ${f.leader} ${f.leaderRet} against ${f.laggard} ${f.laggardRet}.`,
    (f) => `The five-day sector tape shows ${f.leader} in front and ${f.laggard} behind by ${f.spread}.`,
  ],
  short: [
    (f) => `FINRA short interest in ${f.ticker} changed ${f.change} from the prior report.`,
    (f) => `${f.ticker} short interest printed a ${f.change} change on the ${f.settlement} settlement.`,
    (f) => `The consolidated short-interest file shows ${f.ticker} ${f.change} versus the previous quantity.`,
  ],
  ftd: [
    (f) => `Fails-to-deliver in ${f.ticker} reached ${f.notional} on ${f.date}.`,
    (f) => `One SEC fails row for ${f.ticker} is ${f.quantity} shares at ${f.price}, or ${f.notional}.`,
    (f) => `${f.ticker} shows a fails-to-deliver print of ${f.notional} in the latest SEC file.`,
  ],
  insider: [
    (f) => `${f.owners} different owners filed open-market purchases of ${f.ticker} in this Form 4 batch.`,
    (f) => `A cluster of open-market buys showed up in ${f.ticker}: ${f.owners} owners, code P.`,
    (f) => `${f.ticker} drew ${f.owners} separate Form 4 purchase filings in the stored window.`,
  ],
  unusual: [
    (f) => `Open interest in ${f.contract} changed by ${f.change} contracts.`,
    (f) => `${f.ticker} option ${f.contract} added ${f.change} of open interest versus the prior snapshot.`,
    (f) => `The OI diff file flags ${f.contract}, ${f.change} from the stored baseline.`,
  ],
  earnings: [
    (f) => `${f.ticker} realized ${f.realized} against an implied move of ${f.implied}.`,
    (f) => `The stored earnings recap for ${f.ticker} compares implied ${f.implied} with realized ${f.realized}.`,
    (f) => `${f.ticker} moved ${f.gap} away from the implied straddle that was saved before the print.`,
  ],
  macro: [
    (f) => `${f.label} moved ${f.change} points in the FRED file, from ${f.before} to ${f.after}.`,
    (f) => `The rates snapshot shows ${f.label} at ${f.after}, ${f.change} points from the prior stored print.`,
    (f) => `${f.label} changed ${f.change} points between the two FRED rows kept for this series.`,
  ],
  flow: [
    (f) => `Options volume in ${f.ticker} hit ${f.volume} contracts, ${f.ratio} its recent median session.`,
    (f) => `${f.ticker} options traded ${f.ratio} their usual volume on the delayed Cboe chain: ${f.volume} contracts.`,
    (f) => `A volume spike in ${f.ticker} options: ${f.volume} contracts against a median of ${f.median}.`,
  ],
  gamma: [
    (f) => `Dealer gamma in ${f.ticker} flipped from ${f.before} to ${f.after} between the last two stored sessions.`,
    (f) => `${f.ticker} crossed its gamma flip: the naive dealer book moved from ${f.before} to ${f.after}.`,
    (f) => `The open-interest gamma book for ${f.ticker} changed sign, from ${f.before} to ${f.after}.`,
  ],
  iv: [
    (f) => `${f.ticker} iv30 rank is ${f.rank} on ${f.sessions} stored sessions.`,
    (f) => `Implied volatility for ${f.ticker} sits at rank ${f.rank} inside its stored window.`,
    (f) => `${f.ticker} is at an iv30 extreme: rank ${f.rank} with ${f.sessions} sessions on file.`,
  ],
};

export function wordCount(paragraphs) {
  return paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

export function hashSeed(seed) {
  let h = 2166136261;
  for (const char of seed) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function storyPath(story) {
  const [year, month] = story.day.split("-");
  return `/news/${year}/${month}/${story.slug}/`;
}

function dayOf(asOf, fallback) {
  const day = String(asOf ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : fallback;
}

function finite(value) {
  // Number(null) and Number("") are 0. A blank must stay blank, or a missing prior
  // print turns into a "moved from 0.00" story.
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value) {
  if (!Number.isFinite(value)) return "n/a";
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)}%`;
}

function plain(value, digits = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

function compact(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function shares(value) {
  if (!Number.isFinite(value)) return "n/a";
  return Math.round(value).toLocaleString("en-US");
}

function rowsOf(file) {
  const rows = file?.rows;
  if (Array.isArray(rows)) return rows;
  if (rows && typeof rows === "object") return Object.entries(rows).map(([symbol, stats]) => ({ symbol, ...(stats ?? {}) }));
  return [];
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fitBody(seed, lead, sentences) {
  // Sentences are written in reading order: what happened, the numbers behind it, context,
  // then sourcing. A hash shuffle used to scramble that order and made stories read as noise.
  void seed;
  const ordered = [lead, ...sentences].map(humanStamps);
  const paragraphs = [];
  let chunk = [];
  for (const sentence of ordered) {
    chunk.push(sentence);
    if (chunk.length === 3) {
      paragraphs.push(chunk.join(" "));
      chunk = [];
    }
  }
  if (chunk.length) paragraphs.push(chunk.join(" "));
  while (wordCount(paragraphs) > 580 && paragraphs.length > 4) paragraphs.pop();
  return paragraphs;
}

function cite(label, value, source, asOf) {
  return { label, value, source, asOf };
}

const ISO_STAMP = /\b(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z\b/g;

/** Prose shows "Nov 23, 2026, 3:26 PM ET", not a raw ISO stamp. Key numbers keep ISO. */
export function humanStamps(text) {
  return String(text).replace(ISO_STAMP, (match) => {
    const date = new Date(match);
    if (Number.isNaN(date.getTime())) return match;
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return `${label} ET`;
  });
}

function baseStory({ type, ticker, tickers, day, headline, dek, body, keyNumbers, spark, sources, materiality, asOf, dataDate }) {
  const slug = `${ticker.toLowerCase()}-${type}-${day}`;
  const id = `${ticker}|${type}|${day}`;
  return {
    id,
    type,
    ticker,
    tickers,
    day,
    publishedAt: asOf,
    headline,
    dek,
    body,
    keyNumbers,
    spark,
    sources,
    materiality,
    slug,
    passedMateriality: true,
    ...(dataDate ? { dataDate } : {}),
    disclaimer: DISCLAIMER,
    methodology: "/about/methodology/",
  };
}

function measureBlock(items) {
  return items.map((item) => `${item.label} reads ${item.value}. The figure comes from ${item.source} as of ${item.asOf} and is shown exactly as published, without blending in a second data vendor.`);
}

function closer(source, asOf) {
  return [
    `Figures in this piece come from ${source} as of ${asOf}. A blank in that file stays blank here.`,
    "The filter is a threshold on stored data, not a forecast and not a rating.",
    "If a later file revises this figure, the note is updated in place under the same address rather than published twice.",
    "Nothing on this page is a recommendation to buy, sell, or hold. The methodology page describes the other desk scores, which are separate from this write-up.",
  ];
}

function techTable(file) {
  return rowsOf(file).map((row) => ({
    symbol: String(row.symbol ?? "").toUpperCase(),
    ret5d: finite(row.ret5d),
    ret1m: finite(row.ret1m),
    ret3m: finite(row.ret3m),
    rvol20: finite(row.rvol20),
    rsi14: finite(row.rsi14),
    atrPct: finite(row.atrPct),
    pctFrom52wHigh: finite(row.pctFrom52wHigh),
  })).filter((row) => row.symbol);
}

function moverStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "technicals";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const table = techTable(file).filter((row) => !BENCHMARKS.has(row.symbol) && row.ret5d != null);
  const med = median(table.map((row) => row.ret5d));
  const ranked = [...table].sort((a, b) => Math.abs(b.ret5d) - Math.abs(a.ret5d));
  const stories = [];
  for (const row of table) {
    const abs = Math.abs(row.ret5d);
    const loud = abs >= THRESHOLDS.moverAbs || (abs >= THRESHOLDS.moverMild && (row.rvol20 ?? 0) >= THRESHOLDS.moverRvol);
    if (!loud) continue;
    const facts = {
      ticker: row.symbol,
      ret5: pct(row.ret5d),
      ret1: pct(row.ret1m),
      ret3: pct(row.ret3m),
      rvol: plain(row.rvol20, 2),
      rsi: plain(row.rsi14, 1),
      atr: pct(row.atrPct),
      high: pct(row.pctFrom52wHigh),
      median: pct(med),
      rank: String(ranked.findIndex((item) => item.symbol === row.symbol) + 1),
      names: String(table.length),
    };
    const lead = OPENERS.mover[hashSeed(`${row.symbol}|mover|${day}`) % OPENERS.mover.length](facts);
    const body = fitBody(`${row.symbol}|mover|${day}`, lead, [
      `${facts.ticker} is rank ${facts.rank} of ${facts.names} non-benchmark names in this file when sorted by the absolute five-day return.`,
      `The median five-day return among those names is ${facts.median}. Distance from that median is part of why the row was kept.`,
      `Relative volume versus the 20-session average is ${facts.rvol} times. A reading of 1.0 means the latest session matched that average. The mild threshold is ${plain(THRESHOLDS.moverMild * 100, 0)} percent with relative volume of at least ${plain(THRESHOLDS.moverRvol, 1)}, and the hard threshold is ${plain(THRESHOLDS.moverAbs * 100, 0)} percent on its own.`,
      `The one-month return on the same row is ${facts.ret1}. The three-month return is ${facts.ret3}. Those are close-to-close windows, not a path through the session.`,
      `RSI-14 is ${facts.rsi}. It compares the size of recent up closes with recent down closes. It does not say what the next close will be.`,
      `The row is ${facts.high} from its stored 52-week high. Average true range as a share of price is ${facts.atr}.`,
      "This file does not include a premarket print or an opening auction. A headline that quotes the regular-session percent can differ from the five-day close-to-close figure used here.",
      "Open interest, short interest, and fails-to-deliver are other files. They are not folded into this mover unless a separate story cites them.",
      `The ticker page is /t/?s=${facts.ticker}. The chain there is delayed and can be unavailable. That absence is not filled with a guess.`,
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "mover",
      ticker: row.symbol,
      tickers: [row.symbol],
      day,
      asOf,
      headline: `${row.symbol} ${facts.ret5} over five sessions`,
      dek: `${row.symbol} five-day return ${facts.ret5}, relative volume ${facts.rvol}x, from ${source}.`,
      body,
      keyNumbers: [
        cite("Five-day return", facts.ret5, source, asOf),
        cite("One-month return", facts.ret1, source, asOf),
        cite("Three-month return", facts.ret3, source, asOf),
        cite("Relative volume", `${facts.rvol}x`, source, asOf),
        cite("RSI-14", facts.rsi, source, asOf),
        cite("Distance from 52-week high", facts.high, source, asOf),
      ],
      spark: [row.ret3m, row.ret1m, row.ret5d].filter((value) => Number.isFinite(value)),
      sources: [{ name: source, asOf }],
      materiality: abs * 100 + Math.max(0, (row.rvol20 ?? 1) - 1) * 5,
    }));
  }
  return stories;
}

function rotationStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "technicals";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const table = techTable(file).filter((row) => SECTORS.includes(row.symbol) && row.ret5d != null);
  if (table.length < 2) return [];
  const sorted = [...table].sort((a, b) => b.ret5d - a.ret5d);
  const leader = sorted[0];
  const laggard = sorted[sorted.length - 1];
  const spread = leader.ret5d - laggard.ret5d;
  if (spread < THRESHOLDS.rotationSpread) return [];
  const facts = {
    leader: leader.symbol,
    laggard: laggard.symbol,
    leaderRet: pct(leader.ret5d),
    laggardRet: pct(laggard.ret5d),
    spread: pct(spread),
  };
  const lead = OPENERS.rotation[hashSeed(`rotation|${day}`) % OPENERS.rotation.length](facts);
  const listed = sorted.map((row) => `${row.symbol} ${pct(row.ret5d)}`).join(", ");
  const body = fitBody(`rotation|${day}`, lead, [
    `The spread between the leader and the laggard is ${facts.spread}. The story runs only when that gap is at least ${plain(THRESHOLDS.rotationSpread * 100, 0)} percentage points.`,
    `Every sector ETF with a five-day return in the file: ${listed}.`,
    `${sorted.filter((row) => row.ret5d > 0).length} of ${sorted.length} sector funds are up over five sessions and ${sorted.filter((row) => row.ret5d < 0).length} are down. The count uses the sign of the stored return, with a zero left out of both groups.`,
    `${facts.leader} RSI-14 is ${plain(leader.rsi14, 1)} and ${facts.laggard} RSI-14 is ${plain(laggard.rsi14, 1)}. Relative volume is ${plain(leader.rvol20, 2)} times for the leader and ${plain(laggard.rvol20, 2)} times for the laggard.`,
    `${facts.leader} is ${pct(leader.pctFrom52wHigh)} from its stored 52-week high. ${facts.laggard} is ${pct(laggard.pctFrom52wHigh)} from its own high. Those distances are not the five-day gap.`,
    "These are ETF closes, not a survey of every stock inside the sector. A single large holding can move the fund without the rest of the group agreeing.",
    "SPY is excluded from this pair so the note is a sector gap rather than a market-versus-sector gap. The rotation page still shows the broader set.",
    "A five-day lead can vanish in the next file. This write-up does not project the next window.",
    `The leader five-day figure is ${facts.leaderRet} and the laggard is ${facts.laggardRet}. Subtracting those stored returns, rather than a ratio, is the gap quoted above.`,
    ...closer(source, asOf),
  ]);
  return [baseStory({
    type: "rotation",
    ticker: "SECTORS",
    tickers: [leader.symbol, laggard.symbol],
    day,
    asOf,
    headline: `${leader.symbol} leads, ${laggard.symbol} lags by ${facts.spread}`,
    dek: `Sector ETF five-day gap ${facts.spread} from ${source}.`,
    body,
    keyNumbers: [
      cite(`${leader.symbol} five-day return`, facts.leaderRet, source, asOf),
      cite(`${laggard.symbol} five-day return`, facts.laggardRet, source, asOf),
      cite("Leader minus laggard", facts.spread, source, asOf),
    ],
    spark: sorted.map((row) => row.ret5d),
    sources: [{ name: source, asOf }],
    materiality: spread * 100,
  })];
}

function shortStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "FINRA short interest";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const stories = [];
  for (const row of rowsOf(file)) {
    const ticker = String(row.symbolCode ?? row.symbol ?? "").toUpperCase();
    const change = finite(row.changePercent);
    const days = finite(row.daysToCoverQuantity ?? row.daysToCover);
    if (!ticker || change == null) continue;
    if (Math.abs(change) < THRESHOLDS.shortChange && (days == null || days < THRESHOLDS.shortDays)) continue;
    const current = finite(row.currentShortPositionQuantity);
    const previous = finite(row.previousShortPositionQuantity);
    const settlement = String(row.settlementDate ?? asOf).slice(0, 10);
    // An old settlement is not news. Skip rows more than STALE_SHORT_DAYS past settlement.
    const settledAt = Date.parse(`${settlement}T00:00:00Z`);
    const nowAt = Date.parse(`${fallbackDay}T00:00:00Z`);
    if (Number.isFinite(settledAt) && Number.isFinite(nowAt) && nowAt - settledAt > THRESHOLDS.staleShortDays * 86_400_000) continue;
    const facts = { ticker, change: `${change > 0 ? "+" : ""}${plain(change, 2)}%`, settlement };
    const lead = OPENERS.short[hashSeed(`${ticker}|short|${day}`) % OPENERS.short.length](facts);
    const body = fitBody(`${ticker}|short|${day}`, lead, [
      `Current short position is ${shares(current)} shares. The previous report was ${shares(previous)} shares. The change in shares is ${shares(finite(row.changePreviousNumber))}.`,
      `Days to cover is ${plain(days, 2)}. That is the position divided by average daily volume in the same FINRA row, which is ${shares(finite(row.averageDailyVolumeQuantity))} shares. Float is not in this file, so short interest as a percent of float is not stated.`,
      `Issue name on the row: ${row.issueName ?? "not provided"}. Market class ${row.marketClassCode ?? "n/a"}. Accounting period ${row.accountingYearMonthNumber ?? "n/a"}.`,
      `Dividing the current position by the previous position gives a ratio of ${previous ? plain(current / previous, 3) : "n/a"}. The published change percent is ${facts.change}, and this article uses that published field rather than a recomputed percent.`,
      `Settlement date on the row is ${settlement}. FINRA publishes this series about twice a month, so the figure can be weeks older than the file timestamp ${asOf}.`,
      `The story threshold is a ${plain(THRESHOLDS.shortChange, 0)} percent change, or days to cover of at least ${plain(THRESHOLDS.shortDays, 0)}. ${ticker} met that bar in this file.`,
      "A rise in short interest is not by itself a bullish or bearish signal. It records shares borrowed and sold short, as FINRA consolidated them.",
      `Average daily volume on the row is ${shares(finite(row.averageDailyVolumeQuantity))}. Days to cover of ${plain(days, 2)} is the position divided by that volume. A blank volume would leave days to cover blank, and this article would not invent it.`,
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "short",
      ticker,
      tickers: [ticker],
      day,
      asOf,
      headline: `${ticker} short interest ${facts.change}`,
      dek: `${ticker} short interest changed ${facts.change} as of settlement ${settlement}.`,
      body,
      keyNumbers: [
        cite("Change versus prior report", facts.change, source, asOf),
        cite("Current short position", shares(current), source, asOf),
        cite("Previous short position", shares(previous), source, asOf),
        cite("Days to cover", plain(days, 2), source, asOf),
        cite("Settlement", settlement, source, asOf),
      ],
      spark: [previous, current].filter((value) => Number.isFinite(value)),
      sources: [{ name: source, asOf }],
      materiality: Math.abs(change),
    }));
  }
  return stories;
}

function ftdStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "SEC fails-to-deliver";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const best = new Map();
  for (const row of rowsOf(file)) {
    const ticker = String(row.symbol ?? "").toUpperCase();
    const quantity = finite(row.quantity);
    const price = finite(row.price);
    if (!ticker || quantity == null || price == null) continue;
    const notional = quantity * price;
    const prev = best.get(ticker);
    if (!prev || notional > prev.notional) best.set(ticker, { ticker, quantity, price, notional, date: String(row.date ?? "").slice(0, 10), description: row.description ?? "" });
  }
  const stories = [];
  for (const row of best.values()) {
    if (row.notional < THRESHOLDS.ftdNotional) continue;
    const facts = {
      ticker: row.ticker,
      notional: compact(row.notional),
      quantity: shares(row.quantity),
      price: `$${plain(row.price, 2)}`,
      date: row.date || day,
    };
    const lead = OPENERS.ftd[hashSeed(`${row.ticker}|ftd|${day}`) % OPENERS.ftd.length](facts);
    const body = fitBody(`${row.ticker}|ftd|${day}`, lead, [
      `The row is ${facts.quantity} shares at ${facts.price}, which multiplies to ${facts.notional}. The description on the row is ${row.description || "blank"}.`,
      `Only the single largest print for ${facts.ticker} inside this file is used. Other days are not added together, so the figure is one settlement, not a monthly total.`,
      `The threshold is ${compact(THRESHOLDS.ftdNotional)}. This print is ${plain(row.notional / THRESHOLDS.ftdNotional, 2)} times that floor. Prints below the floor stay in the data file and do not become a story.`,
      `The file holds ${rowsOf(file).filter((item) => String(item.symbol ?? "").toUpperCase() === facts.ticker).length} rows for ${facts.ticker}. Only the largest notional is in the headline. The others are not summed.`,
      `SEC fails-to-deliver arrive with a lag of about three weeks. The file timestamp is ${asOf}. The row date is ${facts.date}.`,
      "A fail is a settlement miss. It is not a count of naked shorts and it is not a signal by itself.",
      `Quantity times price is ${facts.quantity} times ${facts.price}. That product is ${facts.notional}. The article does not adjust for splits, corporate actions, or later corrections unless a newer file replaces the row.`,
      `The threshold comparison uses ${compact(THRESHOLDS.ftdNotional)} of notional on one row. ${facts.ticker} cleared it on ${facts.date}. A second symbol in the same file gets its own story only when its own largest row also clears the floor.`,
      "Readers can open the shorts page for the FINRA series and the ticker page for the delayed tape. Those pages do not reuse this notional unless they load the same SEC file.",
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "ftd",
      ticker: row.ticker,
      tickers: [row.ticker],
      day,
      asOf,
      headline: `${row.ticker} fails-to-deliver ${facts.notional}`,
      dek: `${facts.quantity} shares of ${row.ticker} failed on ${facts.date} at ${facts.price}.`,
      body,
      keyNumbers: [
        cite("Notional", facts.notional, source, asOf),
        cite("Quantity", facts.quantity, source, asOf),
        cite("Price on the row", facts.price, source, asOf),
        cite("Row date", facts.date, source, asOf),
      ],
      spark: [row.notional],
      sources: [{ name: source, asOf }],
      materiality: row.notional / 1e6,
    }));
  }
  return stories;
}

function insiderStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "SEC EDGAR Form 4";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const groups = new Map();
  for (const row of rowsOf(file)) {
    const trade = row.trade ?? row;
    const ticker = String(trade.ticker ?? "").toUpperCase();
    if (!ticker || trade.code !== "P" || trade.acquired === false) continue;
    // A cluster has to be recent and fully priced: no blank or zero share counts or
    // prices, and every filing inside the window before the file date.
    const sharesBought = finite(trade.shares);
    const price = finite(trade.price);
    if (!(sharesBought > 0) || !(price > 0)) continue;
    const filed = String(row.filed ?? "").slice(0, 10);
    const filedAt = Date.parse(`${filed}T00:00:00Z`);
    const fileAt = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(filedAt) || (Number.isFinite(fileAt) && fileAt - filedAt > THRESHOLDS.insiderWindowDays * 86_400_000)) continue;
    const bucket = groups.get(ticker) ?? [];
    bucket.push({ owner: trade.owner ?? "unknown", shares: sharesBought, price, filed });
    groups.set(ticker, bucket);
  }
  const stories = [];
  for (const [ticker, trades] of groups) {
    const owners = [...new Set(trades.map((trade) => trade.owner))];
    if (owners.length < THRESHOLDS.insiderOwners) continue;
    const shareSum = trades.reduce((sum, trade) => sum + (trade.shares ?? 0), 0);
    const dollars = trades.reduce((sum, trade) => sum + trade.shares * trade.price, 0);
    const latestFiled = trades.map((trade) => trade.filed).sort().at(-1);
    const facts = { ticker, owners: String(owners.length) };
    const lead = OPENERS.insider[hashSeed(`${ticker}|insider|${day}`) % OPENERS.insider.length](facts);
    const lines = trades.map((trade) => `${trade.owner} bought ${shares(trade.shares)} shares at $${plain(trade.price, 2)} filed ${trade.filed ?? "on an undated row"}`);
    const body = fitBody(`${ticker}|insider|${day}`, lead, [
      `The filings are ${lines.join("; ")}.`,
      `Together those purchase rows list ${shares(shareSum)} shares. Prices are the values on each Form 4, not a blended average unless a reader computes one.`,
      "Only transaction code P with acquired set is counted. Awards, gifts, and sales stay out of a cluster-buy story.",
      `Owners on the cluster: ${owners.join(", ")}. Each name is the owner string on the Form 4, not a fund look-through.`,
      "A cluster is a count of people in one batch. It is not a measure of how informed the buyers were, and it is not compared with their prior sales unless those sales are in a different story.",
      ...measureBlock([
        cite("Distinct buyers", String(owners.length), source, asOf),
        cite("Shares on those rows", shares(shareSum), source, asOf),
      ]),
      `The cluster rule is at least ${THRESHOLDS.insiderOwners} distinct owners in the same stored batch. One buyer, however large, does not qualify.`,
      "Form 4 can be filed up to two business days after the trade. The filing date is not always the trade date.",
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "insider",
      ticker,
      tickers: [ticker],
      day,
      asOf,
      headline: `${owners.length} insiders bought ${compact(dollars)} of ${ticker} in the open market`,
      dek: `${owners.length} Form 4 code-P buyers in ${ticker} within ${THRESHOLDS.insiderWindowDays} days, ${compact(dollars)} in total, from ${source}.`,
      dataDate: latestFiled,
      body,
      keyNumbers: [
        cite("Distinct buyers", String(owners.length), source, asOf),
        cite("Shares on those rows", shares(shareSum), source, asOf),
        cite("Dollar value of the buys", compact(dollars), source, asOf),
      ],
      spark: trades.map((trade) => trade.shares).filter((value) => Number.isFinite(value)),
      sources: [{ name: source, asOf }],
      materiality: owners.length * 10,
    }));
  }
  return stories;
}

function parseOcc(symbol) {
  const match = String(symbol ?? "").toUpperCase().match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return null;
  return { root: match[1], expiry: `20${match[2]}-${match[3]}-${match[4]}`, right: match[5] === "C" ? "call" : "put", strike: Number(match[6]) / 1000, symbol: match[0] };
}

function unusualStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "open interest";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  if (file?.meta?.unavailable) return [];
  const perRoot = new Map();
  for (const row of rowsOf(file)) {
    const parsed = parseOcc(row.symbol);
    const change = finite(row.change);
    const previous = finite(row.previous);
    const current = finite(row.current);
    if (!parsed || change == null || previous == null) continue;
    const frac = previous === 0 ? 0 : Math.abs(change) / previous;
    if (Math.abs(change) < THRESHOLDS.oiChangeAbs || frac < THRESHOLDS.oiChangeFrac) continue;
    const score = Math.abs(change);
    const prior = perRoot.get(parsed.root);
    if (!prior || score > prior.score) perRoot.set(parsed.root, { parsed, change, previous, current, score });
  }
  const stories = [];
  for (const row of perRoot.values()) {
    const facts = {
      ticker: row.parsed.root,
      contract: `${row.parsed.root} ${row.parsed.expiry} ${row.parsed.strike}${row.parsed.right === "call" ? "C" : "P"}`,
      change: shares(row.change),
    };
    const lead = OPENERS.unusual[hashSeed(`${row.parsed.root}|unusual|${day}`) % OPENERS.unusual.length](facts);
    const body = fitBody(`${row.parsed.root}|unusual|${day}`, lead, [
      `Previous open interest was ${shares(row.previous)}. Current open interest is ${shares(row.current)}. The change is ${facts.change}.`,
      `The contract is the ${row.parsed.expiry} ${row.parsed.strike} ${row.parsed.right}. The root is ${row.parsed.root}.`,
      `A row qualifies when the absolute change is at least ${shares(THRESHOLDS.oiChangeAbs)} and at least ${plain(THRESHOLDS.oiChangeFrac * 100, 0)} percent of the prior open interest. One story is kept per underlying, the largest qualifying change.`,
      "Open interest is a position count, not a print on the tape. It does not say whether the new contracts were bought or sold.",
      `The fraction versus the prior open interest is ${row.previous === 0 ? "undefined" : plain(Math.abs(row.change) / row.previous, 2)} times. Both the contract count and that fraction have to clear the filter.`,
      "Greeks and premium are not in the OI diff row, so this article does not quote delta or a dollar value for the change.",
      ...measureBlock([
        cite("Open interest change", facts.change, source, asOf),
        cite("Previous open interest", shares(row.previous), source, asOf),
        cite("Current open interest", shares(row.current), source, asOf),
      ]),
      "If the prior snapshot is missing, this file stays empty and no unusual story is written. A zero is not invented to fill the gap.",
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "unusual",
      ticker: row.parsed.root,
      tickers: [row.parsed.root],
      day,
      asOf,
      headline: `${facts.contract} open interest ${facts.change}`,
      dek: `Largest qualifying OI change in ${row.parsed.root} from ${source}.`,
      body,
      keyNumbers: [
        cite("Open interest change", facts.change, source, asOf),
        cite("Previous open interest", shares(row.previous), source, asOf),
        cite("Current open interest", shares(row.current), source, asOf),
        cite("Contract", facts.contract, source, asOf),
      ],
      spark: [row.previous, row.current],
      sources: [{ name: source, asOf }],
      materiality: row.score / 100,
    }));
  }
  return stories;
}

function asMove(value) {
  const number = finite(value);
  if (number == null) return null;
  return Math.abs(number) > 1.5 ? number / 100 : number;
}

function earningsStories(file, fallbackDay) {
  const source = file?.meta?.source ?? "earnings moves";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const stories = [];
  for (const row of rowsOf(file)) {
    const ticker = String(row.sym ?? row.symbol ?? row.ticker ?? "").toUpperCase();
    const implied = asMove(row.implied ?? row.impliedMove);
    const realized = asMove(row.realized ?? row.realizedMove);
    if (!ticker || implied == null || realized == null || !(Math.abs(implied) > 0)) continue;
    // Only a report whose reaction closed in the last few days is news. The history file
    // holds four quarters per name, and an old quarter must not resurface as today's story.
    const after = String(row.afterDate ?? "").slice(0, 10);
    const afterAt = Date.parse(`${after}T00:00:00Z`);
    const dayAt = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(afterAt) || dayAt - afterAt > 3 * 86_400_000 || afterAt - dayAt > 86_400_000) continue;
    const gap = Math.abs(realized) - Math.abs(implied);
    if (Math.abs(gap) < THRESHOLDS.earningsGap) continue;
    const facts = { ticker, implied: `±${pct(Math.abs(implied)).replace(/^[+-]/, "")}`, realized: pct(realized), gap: pct(gap) };
    const lead = OPENERS.earnings[hashSeed(`${ticker}|earnings|${day}`) % OPENERS.earnings.length](facts);
    const body = fitBody(`${ticker}|earnings|${day}`, lead, [
      `Implied move on the stored row is ${facts.implied}. Realized move is ${facts.realized}. The difference of absolute values is ${facts.gap}.`,
      `The story runs when that difference is at least ${plain(THRESHOLDS.earningsGap * 100, 0)} percentage points. Smaller gaps stay in the file.`,
      `Implied came from ${row.impliedSource ?? "an at-the-money straddle"}${row.impliedExpiry ? ` for the ${row.impliedExpiry} expiry` : ""}, priced at the close on ${row.beforeDate ?? "the prior session"}.`,
      `The report date is ${row.reportDate ?? "not on the row"}. The move runs from the close on ${row.beforeDate ?? "the prior session"} to the close on ${after}, so it holds the reaction whether the report came before the open or after the close.`,
      "Implied is the straddle price divided by the stock price, so it has no direction. Realized is the close-to-close move over the same window. If either field is missing, the name is skipped.",
      "The comparison uses absolute values, so a down realized move and an up implied move are measured by size. The sign of the realized move is still printed in the table.",
      ...measureBlock([
        cite("Implied move", facts.implied, source, asOf),
        cite("Realized move", facts.realized, source, asOf),
        cite("Absolute gap", facts.gap, source, asOf),
      ]),
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "earnings",
      ticker,
      tickers: [ticker],
      day: dayOf(row.reportDate, day),
      asOf,
      dataDate: after,
      headline: `${ticker} realized ${facts.realized} versus implied ${facts.implied}`,
      dek: `Implied versus realized gap ${facts.gap} for ${ticker}.`,
      body,
      keyNumbers: [
        cite("Implied move", facts.implied, source, asOf),
        cite("Realized move", facts.realized, source, asOf),
        cite("Absolute gap", facts.gap, source, asOf),
      ],
      spark: [implied, realized],
      sources: [{ name: source, asOf }],
      materiality: Math.abs(gap) * 100,
    }));
  }
  return stories;
}

const MACRO_LABELS = {
  DGS3MO: "3-month Treasury",
  DGS2: "2-year Treasury",
  DGS10: "10-year Treasury",
  DGS30: "30-year Treasury",
  T10Y2Y: "10-year minus 2-year",
  T10Y3M: "10-year minus 3-month",
  BAMLH0A0HYM2: "high-yield spread",
  DFF: "fed funds",
};

function macroStories(file, previous, fallbackDay) {
  const source = file?.meta?.source ?? "FRED";
  const asOf = file?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const now = new Map(rowsOf(file).map((row) => [row.id, finite(row.value)]));
  const before = new Map(rowsOf(previous).map((row) => [row.id, finite(row.value)]));
  const stories = [];
  for (const [id, label] of Object.entries(MACRO_LABELS)) {
    const after = now.get(id);
    const prior = before.get(id);
    if (after == null || prior == null) continue;
    const change = after - prior;
    if (Math.abs(change) < THRESHOLDS.macroPoints) continue;
    const facts = { label, change: `${change > 0 ? "+" : ""}${plain(change, 2)}`, before: plain(prior, 2), after: plain(after, 2) };
    const lead = OPENERS.macro[hashSeed(`${id}|macro|${day}`) % OPENERS.macro.length](facts);
    const body = fitBody(`${id}|macro|${day}`, lead, [
      `${label} (${id}) was ${facts.before} and is ${facts.after}. The change is ${facts.change} points.`,
      `A macro story is written only when a prior FRED row exists and the move is at least ${plain(THRESHOLDS.macroPoints, 2)} points. A single level, with no prior print, is not turned into a change.`,
      "VIX futures are not in this file. They are not estimated from the Treasury rows.",
      `Other series on the current file are left out of this headline unless they also clear ${plain(THRESHOLDS.macroPoints, 2)} points against their own prior print.`,
      "FRED prints can repeat on holidays. A zero change does not become a story. The unit is the unit FRED published for the series, which for these yields is percent.",
      `${id} is the FRED series id. The label in the headline is the desk name for that id, and the numbers stay the published prints.`,
      ...measureBlock([
        cite(label, facts.after, source, asOf),
        cite("Prior print", facts.before, source, asOf),
        cite("Change", facts.change, source, asOf),
      ]),
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "macro",
      ticker: id,
      tickers: [id],
      day,
      asOf,
      headline: `${label} ${facts.change} points`,
      dek: `${id} moved from ${facts.before} to ${facts.after} in ${source}.`,
      body,
      keyNumbers: [
        cite(label, facts.after, source, asOf),
        cite("Prior print", facts.before, source, asOf),
        cite("Change", facts.change, source, asOf),
      ],
      spark: [prior, after],
      sources: [{ name: source, asOf }],
      materiality: Math.abs(change) * 100,
    }));
  }
  return stories;
}

function ivRank(history) {
  if (!history || history.length < 20) return null;
  const window = history.slice(-252);
  const low = Math.min(...window);
  const high = Math.max(...window);
  if (high === low) return null;
  return (window[window.length - 1] - low) / (high - low);
}

function ivStories(file, historyFile, fallbackDay) {
  const source = file?.meta?.source ?? historyFile?.meta?.source ?? "iv30";
  const asOf = file?.meta?.asOf ?? historyFile?.meta?.asOf ?? fallbackDay;
  const day = dayOf(asOf, fallbackDay);
  const series = historyFile?.series && typeof historyFile.series === "object" ? historyFile.series : {};
  const stories = [];
  for (const [symbol, points] of Object.entries(series)) {
    const values = (Array.isArray(points) ? points : []).map((point) => finite(Array.isArray(point) ? point[1] : point?.iv30)).filter((value) => value != null);
    const rank = ivRank(values);
    if (rank == null || (rank > THRESHOLDS.ivRankLow && rank < THRESHOLDS.ivRankHigh)) continue;
    const latest = values[values.length - 1];
    const facts = { ticker: symbol, rank: pct(rank), sessions: String(values.length) };
    const lead = OPENERS.iv[hashSeed(`${symbol}|iv|${day}`) % OPENERS.iv.length](facts);
    const body = fitBody(`${symbol}|iv|${day}`, lead, [
      `Latest iv30 is ${plain(latest, 2)}. Rank is the position of that print between the low and the high of the stored window, which has ${facts.sessions} sessions.`,
      `A story is published only at or below ${plain(THRESHOLDS.ivRankLow * 100, 0)} or at or above ${plain(THRESHOLDS.ivRankHigh * 100, 0)}, and only after 20 sessions. Fewer sessions stay marked building and produce no article.`,
      "Cboe iv30 is a percent. This rank uses the stored series as-is and does not invent the missing days.",
      `The low of the window is ${plain(Math.min(...values), 2)} and the high is ${plain(Math.max(...values), 2)}. Rank is (latest minus low) divided by (high minus low).`,
      "A rank near 100 means the latest print is near the top of the stored range. It is not a prediction that volatility will fall.",
      `This series currently holds ${facts.sessions} prints for ${symbol}. Rank stays unpublished below 20 prints, which is why a one-point file never becomes an article.`,
      ...measureBlock([
        cite("iv30", plain(latest, 2), source, asOf),
        cite("Rank", facts.rank, source, asOf),
        cite("Sessions", facts.sessions, source, asOf),
      ]),
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "iv",
      ticker: symbol,
      tickers: [symbol],
      day,
      asOf,
      headline: `${symbol} iv30 rank ${facts.rank}`,
      dek: `${symbol} implied-volatility rank ${facts.rank} on ${facts.sessions} sessions.`,
      body,
      keyNumbers: [
        cite("iv30", plain(latest, 2), source, asOf),
        cite("Rank", facts.rank, source, asOf),
        cite("Sessions", facts.sessions, source, asOf),
      ],
      spark: values.slice(-12),
      sources: [{ name: source, asOf }],
      materiality: Math.abs(rank - 0.5) * 100,
    }));
  }
  return stories;
}


function seriesOf(file) {
  const series = file?.series;
  return series && typeof series === "object" ? series : {};
}

/** Options volume at least flowSpikeRatio times the median of the prior sessions. */
export function flowStories(file, fallbackDay) {
  const source = "Cboe delayed option chain";
  const stories = [];
  for (const [ticker, rows] of Object.entries(seriesOf(file))) {
    if (!Array.isArray(rows) || rows.length < THRESHOLDS.flowSpikeMinSessions + 1) continue;
    const today = rows.at(-1);
    const total = (row) => {
      const calls = finite(row?.callVolume);
      const puts = finite(row?.putVolume);
      return calls != null && puts != null && calls + puts > 0 ? calls + puts : null;
    };
    const volume = total(today);
    const prior = rows.slice(0, -1).slice(-20).map(total).filter((value) => value != null && value > 0);
    if (volume == null || prior.length < THRESHOLDS.flowSpikeMinSessions) continue;
    const base = median(prior);
    if (!(base > 0) || volume < THRESHOLDS.flowSpikeMinContracts) continue;
    const ratio = volume / base;
    if (ratio < THRESHOLDS.flowSpikeRatio) continue;
    const calls = finite(today.callVolume);
    const puts = finite(today.putVolume);
    const callPremium = finite(today.callPremium);
    const putPremium = finite(today.putPremium);
    const day = dayOf(today.date, fallbackDay);
    const asOf = today.asOf ? `${String(today.asOf).replace(" ", "T").slice(0, 19)}Z` : `${day}T21:00:00Z`;
    const facts = { ticker, volume: shares(volume), ratio: `${plain(ratio, 1)}x`, median: shares(base) };
    const lead = OPENERS.flow[hashSeed(`${ticker}|flow|${day}`) % OPENERS.flow.length](facts);
    const callShare = calls / volume;
    const tilt = callShare >= 0.6 ? "call-heavy" : callShare <= 0.4 ? "put-heavy" : "balanced between calls and puts";
    const body = fitBody(`${ticker}|flow|${day}`, lead, [
      `Calls were ${shares(calls)} contracts and puts were ${shares(puts)}, so the session was ${tilt}. The call share is ${plain(callShare * 100, 1)} percent of the total.`,
      callPremium != null && putPremium != null && callPremium + putPremium > 0
        ? `Estimated premium, volume times the last trade price for each contract, was ${compact(callPremium)} in calls and ${compact(putPremium)} in puts.`
        : "The chain did not carry enough last-trade prices to estimate premium, so no dollar figure is quoted.",
      `The baseline is the median total volume of the previous ${prior.length} stored sessions, ${shares(base)} contracts. A median keeps one earlier spike from raising the bar for every later day.`,
      `A story runs when the session reaches ${plain(THRESHOLDS.flowSpikeRatio, 1)} times that median and at least ${shares(THRESHOLDS.flowSpikeMinContracts)} contracts. Smaller names with thin chains do not qualify on ratio alone.`,
      "Volume counts contracts traded, not positions opened. A spike can be opening, closing, or both, and it does not say which side was the buyer.",
      `The stored spot price for ${ticker} on this session is $${plain(finite(today.spot), 2)}. The chain is delayed about 15 minutes, and an intraday reading can rise further before the close.`,
      ...measureBlock([
        cite("Option volume", shares(volume), source, asOf),
        cite("Median of prior sessions", shares(base), source, asOf),
        cite("Ratio to median", facts.ratio, source, asOf),
      ]),
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "flow",
      ticker,
      tickers: [ticker],
      day,
      asOf,
      dataDate: day,
      headline: `${ticker} options volume ${facts.ratio} normal, ${tilt.startsWith("balanced") ? "split" : tilt}`,
      dek: `${facts.volume} ${ticker} contracts traded against a ${facts.median} median, from the delayed Cboe chain.`,
      body,
      keyNumbers: [
        cite("Option volume", shares(volume), source, asOf),
        cite("Median of prior sessions", shares(base), source, asOf),
        cite("Ratio to median", facts.ratio, source, asOf),
        cite("Call share", `${plain(callShare * 100, 1)}%`, source, asOf),
      ],
      spark: [...prior.slice(-10), volume],
      sources: [{ name: source, asOf }],
      materiality: 30 + ratio * 10,
    }));
  }
  return stories;
}

/** Dealer net gamma changed sign between the last two sessions, with size on both sides. */
export function gammaStories(file, fallbackDay) {
  const source = "Cboe delayed option chain, open-interest gamma";
  const stories = [];
  for (const [ticker, rows] of Object.entries(seriesOf(file))) {
    if (!Array.isArray(rows) || rows.length < 2) continue;
    const [before, after] = rows.slice(-2);
    const prev = finite(before?.netGex);
    const next = finite(after?.netGex);
    if (prev == null || next == null || prev === 0 || next === 0) continue;
    if (Math.sign(prev) === Math.sign(next)) continue;
    if (Math.abs(prev) < THRESHOLDS.gammaMinAbs || Math.abs(next) < THRESHOLDS.gammaMinAbs) continue;
    const gap = (Date.parse(`${after.date}T00:00:00Z`) - Date.parse(`${before.date}T00:00:00Z`)) / 86_400_000;
    if (!(gap > 0 && gap <= 4)) continue;
    const spot = finite(after.spot);
    const flip = finite(after.flip);
    if (!(spot > 0)) continue;
    const day = dayOf(after.date, fallbackDay);
    const asOf = after.asOf ? `${String(after.asOf).replace(" ", "T").slice(0, 19)}Z` : `${day}T21:00:00Z`;
    const label = (value) => (value > 0 ? "long gamma" : "short gamma");
    const facts = { ticker, before: label(prev), after: label(next) };
    const lead = OPENERS.gamma[hashSeed(`${ticker}|gamma|${day}`) % OPENERS.gamma.length](facts);
    const meaning = next < 0
      ? "In a short-gamma book, dealer hedging tends to follow price, which can widen intraday ranges."
      : "In a long-gamma book, dealer hedging tends to lean against price, which can damp intraday ranges.";
    const body = fitBody(`${ticker}|gamma|${day}`, lead, [
      `Net gamma per 1 percent move was ${compact(prev)} on ${before.date} and ${compact(next)} on ${after.date}.`,
      flip != null ? `The stored flip level, where repriced net gamma crosses zero, is $${plain(flip, 2)} against a spot of $${plain(spot, 2)}.` : `Spot on the later session was $${plain(spot, 2)}. No zero crossing was found within 15 percent of spot.`,
      meaning,
      "The sign convention is naive: calls count as dealer long and puts as dealer short. Real dealer positioning is not published, so the level is an estimate, not a measurement.",
      `Both sessions have to carry at least ${compact(THRESHOLDS.gammaMinAbs)} of net gamma, so a book hovering near zero does not flip a headline back and forth.`,
      "Gamma is repriced with Black-Scholes from each contract's implied volatility and open interest. Open interest updates once a day, so the book moves mostly with spot and time.",
      ...measureBlock([
        cite("Net gamma, prior session", compact(prev), source, asOf),
        cite("Net gamma, latest session", compact(next), source, asOf),
        ...(flip != null ? [cite("Gamma flip level", `$${plain(flip, 2)}`, source, asOf)] : []),
      ]),
      ...closer(source, asOf),
    ]);
    stories.push(baseStory({
      type: "gamma",
      ticker,
      tickers: [ticker],
      day,
      asOf,
      dataDate: day,
      headline: `${ticker} dealers flip to ${label(next)}${flip != null ? ` with the flip at $${plain(flip, 2)}` : ""}`,
      dek: `Net gamma moved from ${compact(prev)} to ${compact(next)} on the delayed Cboe chain.`,
      body,
      keyNumbers: [
        cite("Net gamma, prior session", compact(prev), source, asOf),
        cite("Net gamma, latest session", compact(next), source, asOf),
        cite("Spot", `$${plain(spot, 2)}`, source, asOf),
        ...(flip != null ? [cite("Gamma flip level", `$${plain(flip, 2)}`, source, asOf)] : []),
      ],
      spark: rows.slice(-10).map((row) => finite(row.netGex)).filter((value) => value != null),
      sources: [{ name: source, asOf }],
      materiality: 45 + Math.min(30, Math.log10(Math.abs(next) + 1)),
    }));
  }
  return stories;
}

const BLANKS = /\b(NaN|undefined|null|Infinity)\b|\bn\/a\b/;
const ZERO_VALUE = /^[+-]?\$?0(?:[.,]0+)?(?:[%x]|[KMB])?$/;

/**
 * Last gate before a story ships, for every generator. A story is refused when any shown
 * number is blank, zero, or not finite, when its text carries a placeholder, or when its
 * data is older than the type allows. Returns the reasons, empty when the story passes.
 */
export function validateStory(story, now = new Date()) {
  const reasons = [];
  if (!story || typeof story !== "object") return ["not a story"];
  for (const field of ["id", "type", "ticker", "headline", "dek", "day", "publishedAt"]) {
    if (typeof story[field] !== "string" || !story[field].trim()) reasons.push(`missing ${field}`);
  }
  const text = [story.headline, story.dek, ...(Array.isArray(story.body) ? story.body : [])].join(" ");
  if (BLANKS.test(String(story.headline ?? "")) || BLANKS.test(String(story.dek ?? ""))) reasons.push("placeholder in headline or dek");
  if (/\b(NaN|undefined|Infinity)\b/.test(text)) reasons.push("placeholder in body");
  const numbers = Array.isArray(story.keyNumbers) ? story.keyNumbers : [];
  if (numbers.length === 0) reasons.push("no key numbers");
  for (const item of numbers) {
    const value = String(item?.value ?? "").trim();
    if (!value || value === "—" || BLANKS.test(value)) reasons.push(`blank key number ${item?.label ?? "?"}`);
    else if (ZERO_VALUE.test(value.replace(/,/g, ""))) reasons.push(`zero key number ${item?.label ?? "?"}`);
  }
  if (Array.isArray(story.spark) && story.spark.some((value) => !Number.isFinite(value))) reasons.push("non-finite spark");
  const published = Date.parse(String(story.publishedAt ?? ""));
  if (!Number.isFinite(published)) reasons.push("publishedAt is not a date");
  else if (published > now.getTime() + 6 * 3_600_000) reasons.push("publishedAt is in the future");
  const limit = STALE_DAYS[story.type];
  const dataDate = Date.parse(`${String(story.dataDate ?? story.day ?? "").slice(0, 10)}T00:00:00Z`);
  if (limit != null && Number.isFinite(dataDate) && now.getTime() - dataDate > limit * 86_400_000) reasons.push(`data older than ${limit} days`);
  if (!Number.isFinite(dataDate)) reasons.push("no data date");
  return reasons;
}

/** An input file is usable when it loaded, is not flagged unavailable, and is recent. */
export function usableInput(file, now = new Date(), maxAgeHours = THRESHOLDS.inputMaxAgeHours) {
  if (!file || typeof file !== "object") return false;
  if (file.meta?.unavailable) return false;
  const stamp = Date.parse(String(file.meta?.asOf ?? file.asOf ?? file.generatedAt ?? ""));
  if (!Number.isFinite(stamp)) return false;
  return now.getTime() - stamp <= maxAgeHours * 3_600_000;
}

export function buildStories(input, options = {}) {
  const fallbackDay = dayOf(options.now, new Date().toISOString().slice(0, 10));
  const cap = options.cap ?? THRESHOLDS.cap;
  const now = options.now ? new Date(options.now) : new Date();
  const log = options.log ?? (() => {});
  // Stale or failed inputs write nothing. options.skipInputGate keeps old fixtures usable in tests.
  const ok = (file) => options.skipInputGate === true || usableInput(file, now);
  const all = [
    ...(ok(input.technicals) ? moverStories(input.technicals, fallbackDay) : []),
    ...(ok(input.technicals) ? rotationStories(input.technicals, fallbackDay) : []),
    ...(ok(input.shorts) ? shortStories(input.shorts, fallbackDay) : []),
    ...(ok(input.ftd) ? ftdStories(input.ftd, fallbackDay) : []),
    ...(ok(input.insiders) ? insiderStories(input.insiders, fallbackDay) : []),
    ...(ok(input.oiChange) ? unusualStories(input.oiChange, fallbackDay) : []),
    ...(ok(input.earnings) ? earningsStories(input.earnings, fallbackDay) : []),
    ...(ok(input.macro) ? macroStories(input.macro, input.macroPrevious, fallbackDay) : []),
    ...(ok(input.iv) ? ivStories(input.iv, input.ivHistory, fallbackDay) : []),
    ...(ok(input.optionsHistory) ? flowStories(input.optionsHistory, fallbackDay) : []),
    ...(ok(input.optionsHistory) ? gammaStories(input.optionsHistory, fallbackDay) : []),
  ];
  const valid = all.filter((story) => {
    const reasons = options.skipValidation === true ? [] : validateStory(story, now);
    if (reasons.length) log(`news gate: refused ${story?.id ?? "?"}: ${reasons.join("; ")}`);
    return reasons.length === 0;
  });
  const kept = valid.filter((story) => story.passedMateriality && wordCount(story.body) >= 300 && wordCount(story.body) <= 600);
  const seen = new Set();
  const unique = [];
  for (const story of kept.sort((a, b) => b.materiality - a.materiality)) {
    if (seen.has(story.id)) continue;
    seen.add(story.id);
    unique.push(story);
  }
  const picked = [];
  const types = new Set();
  for (const story of unique) {
    if (types.has(story.type)) continue;
    types.add(story.type);
    picked.push(story);
  }
  // At most PER_TYPE stories of one kind per run, so one busy file (fails-to-deliver,
  // say) cannot fill the whole wire.
  const perType = options.perType ?? THRESHOLDS.perType;
  const count = (type) => picked.filter((item) => item.type === type).length;
  for (const story of unique) {
    if (picked.length >= cap) break;
    if (picked.some((item) => item.id === story.id)) continue;
    if (count(story.type) >= perType) continue;
    picked.push(story);
  }
  return picked.slice(0, cap).sort((a, b) => b.materiality - a.materiality);
}

export function mergeStories(previous, next, keepDays = 45, now = new Date()) {
  const map = new Map();
  const cutoff = now.getTime() - keepDays * 86_400_000;
  for (const story of [...(previous ?? []), ...(next ?? [])]) {
    const when = Date.parse(`${story.day}T00:00:00Z`);
    if (Number.isFinite(when) && when < cutoff) continue;
    map.set(story.id, story);
  }
  return [...map.values()].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)).slice(0, 180);
}
