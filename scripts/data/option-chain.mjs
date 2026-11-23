/** Nightly chain loader. Same fallback order as the worker: Cboe with browser headers, then Alpaca indicative, then Yahoo. */

export const CBOE_BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  referer: "https://www.cboe.com/",
  origin: "https://www.cboe.com",
  "accept-language": "en-US,en;q=0.9",
};

const RETRY = new Set([403, 429, 500, 502, 503, 504]);

export function vendorSymbol(symbol) {
  if (symbol === "BRKB") return { alpaca: "BRK.B", yahoo: "BRK-B" };
  return { alpaca: symbol, yahoo: symbol };
}

export function alpacaSnapshotsUrl(symbol) {
  return `https://data.alpaca.markets/v1beta1/options/snapshots/${encodeURIComponent(vendorSymbol(symbol).alpaca)}?feed=indicative&limit=1000`;
}

export function yahooOptionsUrl(symbol) {
  return `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(vendorSymbol(symbol).yahoo)}`;
}

/** ATM contract closest to 30 days, used when a fallback feed has no published iv30. */
export function nearestIv30(options, spot, now = Date.now()) {
  let best = null;
  let score = Infinity;
  for (const option of options ?? []) {
    const iv = num(option?.iv);
    if (!(iv > 0)) continue;
    const match = String(option.option ?? "").toUpperCase().match(/(\d{2})(\d{2})(\d{2})[CP](\d{8})$/);
    if (!match) continue;
    const expiry = Date.UTC(2000 + Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const dte = (expiry - now) / 86_400_000;
    if (dte < 7 || dte > 60) continue;
    const strike = Number(match[4]) / 1000;
    const distance = spot > 0 ? Math.abs(strike - spot) / spot : 0;
    const rank = Math.abs(dte - 30) + distance * 40;
    if (rank < score) {
      score = rank;
      best = iv;
    }
  }
  return best;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function fromAlpacaSnapshots(payload, symbol, spot) {
  const book = payload?.snapshots ?? {};
  const options = Object.entries(book).map(([option, row]) => ({
    option,
    bid: num(row?.latestQuote?.bp),
    ask: num(row?.latestQuote?.ap),
    iv: num(row?.impliedVolatility),
    open_interest: num(row?.openInterest ?? row?.open_interest),
    volume: num(row?.latestTrade?.s),
    last_trade_price: num(row?.latestTrade?.p),
    delta: num(row?.greeks?.delta),
    gamma: num(row?.greeks?.gamma),
  }));
  if (!options.length) return null;
  return {
    source: "Alpaca indicative",
    timestamp: new Date().toISOString(),
    data: { symbol, current_price: spot, iv30: null, options },
  };
}

export function fromYahooOptions(payload, symbol) {
  const result = payload?.optionChain?.result?.[0];
  if (!result) return null;
  const options = [];
  for (const group of result.options ?? []) {
    for (const row of [...(group.calls ?? []), ...(group.puts ?? [])]) {
      options.push({
        option: row.contractSymbol,
        bid: num(row.bid),
        ask: num(row.ask),
        iv: num(row.impliedVolatility),
        open_interest: num(row.openInterest),
        volume: num(row.volume),
        last_trade_price: num(row.lastPrice),
      });
    }
  }
  if (!options.length) return null;
  return {
    source: "Yahoo options",
    timestamp: new Date().toISOString(),
    data: { symbol, current_price: num(result.quote?.regularMarketPrice), iv30: null, options },
  };
}

export async function loadOptionChain(symbol, options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const errors = [];
  const url = `https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetcher(url, { headers: CBOE_BROWSER_HEADERS });
      if (response.ok) {
        const body = await response.json();
        if (body?.data?.options?.length || typeof body?.data?.iv30 === "number") return { ...body, source: body.source ?? "Cboe delayed" };
        errors.push("cboe empty");
        break;
      }
      errors.push(`cboe ${response.status}`);
      if (!RETRY.has(response.status)) break;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "cboe");
    }
    if (attempt < 2) await sleep(200 * 2 ** attempt);
  }
  const key = options.alpacaKey ?? process.env.ALPACA_KEY_ID;
  const secret = options.alpacaSecret ?? process.env.ALPACA_SECRET;
  if (key && secret) {
    try {
      const headers = { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret };
      let spot = 0;
      const quote = await fetcher(`https://data.alpaca.markets/v2/stocks/${vendorSymbol(symbol).alpaca}/snapshot?feed=iex`, { headers });
      if (quote.ok) {
        const body = await quote.json();
        spot = num(body?.latestTrade?.p ?? body?.trade?.p);
      }
      const response = await fetcher(alpacaSnapshotsUrl(symbol), { headers });
      if (response.ok) {
        const mapped = fromAlpacaSnapshots(await response.json(), symbol, spot);
        if (mapped) return mapped;
      } else errors.push(`alpaca ${response.status}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "alpaca");
    }
  }
  try {
    const response = await fetcher(yahooOptionsUrl(symbol), { headers: { "user-agent": CBOE_BROWSER_HEADERS["user-agent"], accept: "application/json" } });
    if (response.ok) {
      const mapped = fromYahooOptions(await response.json(), symbol);
      if (mapped) return mapped;
    } else errors.push(`yahoo ${response.status}`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "yahoo");
  }
  throw new Error(`No option chain for ${symbol}: ${errors.join("; ")}`);
}
