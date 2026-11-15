# TradeHax

Market intelligence for [TradeHax](https://tradehax.net) (`tradehaxai.tech`). This is the first desk: a watchlist, a ranked feed of directional signals, and a plain-English reason for each one.

It is closer to a briefing than to a raw options tape. Unusual Whales is the comparison for the job to be done. v1 does not show options flow. It shows whether standard indicators agree, on which side, and how hard.

Confidence is model agreement, not a backtested win rate and not a recommendation.

## What you can do

- Scan a watchlist. The default book is SPY, QQQ, IWM, AAPL, NVDA, TSLA, MSFT, and AMD. Add or remove names in the browser. The list is saved locally, up to 12 symbols.
- Read a ranked feed for one timeframe: 1m, 5m, 15m, 1h, 4h, or 1D. Higher confidence is listed first.
- Switch to **Side by side** and see every timeframe for every name, including a sentence on where they agree or fight each other.
- Open a name for a short briefing: the agreement sentence, a chip per timeframe, and the five factor votes that produced the score.

Each signal carries:

- a side: bullish, bearish, or mixed
- a 0–100 confidence score
- one sentence on why it fired
- the five votes behind that sentence: EMA 9/21, MACD 12/26/9, RSI 14, VWAP, and volume versus the last 20 bars

The dashboard refreshes about every 25 seconds while the tab is visible. If the US cash session is closed, prices hold at the last completed bars and the header says so.

## Run it

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` only if you want to change the data source. The default needs no key.

```bash
# .env.local
MARKET_DATA_PROVIDER=yahoo
```

Set `MARKET_DATA_PROVIDER=mock` to force the simulated feed. The screen labels that feed **Demo data**. It never presents simulated prices as the market.

## Deploy

Vercel can host this repo as a Next.js app. Import [DarkModder33/tradehax-intel](https://github.com/DarkModder33/tradehax-intel), leave the framework preset on Next.js, and deploy from `main`. The dashboard calls `/api/dashboard` on the same origin, so the production URL does not need to be set in the app.

No environment variables are required. Yahoo Finance's public chart endpoint is the default. Optional settings:

| Variable | Production value |
| --- | --- |
| `MARKET_DATA_PROVIDER` | `yahoo` (default) or `mock` for the labeled simulated feed |
| `POLYGON_API_KEY`, `FINNHUB_API_KEY`, `TRADIER_API_KEY` | Unused in v1. Leave them unset. |

`npm run build` is the production check. Chart responses are cached in memory on the server process, so a serverless cold start fetches Yahoo again and falls back to the labeled demo feed if that fetch fails.

## Data source

v1 reads [Yahoo Finance's public chart endpoint](https://query1.finance.yahoo.com/v8/finance/chart/) (`/v8/finance/chart/{symbol}`). No API key. Quotes can be delayed, and the endpoint is unofficial, so it can change or rate-limit.

If every requested symbol fails, the server falls back to the simulated feed and says why. A single bad ticker stays as an error on that row. The rest of the book still scores.

Market data goes through `MarketDataProvider` in `src/lib/market/provider.ts`. Yahoo (`src/lib/market/yahoo.ts`) and the demo feed (`src/lib/market/mock.ts`) both implement it. A later Polygon, Tradier, or flow vendor replaces the body of `loadDashboard` in `src/lib/market/dashboard.ts` without a UI rewrite. Chart responses are cached in memory on the server (about 30 seconds for 1-minute bars, longer for slower timeframes). 4h bars are built by folding 1h bars.

## How a score is made

The indicator module is pure and unit-tested. It does not know which vendor produced the bars.

| Vote | Weight | What it looks at |
| --- | --- | --- |
| EMA 9/21 | 22% | Stack, fresh cross, and whether the gap is widening |
| MACD 12/26/9 | 22% | Histogram sign, expansion, and signal-line crosses |
| RSI 14 | 18% | Wilder RSI: oversold, overbought, or a rising/falling mid-range |
| VWAP | 18% | Session VWAP on intraday bars, 20-session VWAP on the daily |
| Volume | 20% | Latest bar versus the previous 20, and whether the bar closed up or down |

Weights live in `src/lib/indicators/score.ts` (`FACTOR_WEIGHTS`). The desk legend reads those same constants.

The weighted average of the votes is `net`, from -1 to +1. Confidence is 70% the size of that vote and 30% how many factors that took a side agree, then scaled down when some factors stay neutral. A single loud indicator cannot score like a full agreement. If `net` is within 0.12 of zero, the timeframe is mixed. A timeframe needs 40 bars before it is scored. Below that, the card says there is not enough history.

Timeframe agreement is separate. It counts how many of the six timeframes share a side, and it calls out the case where 1m/5m/15m fight 1h/4h/1D.

## Architecture

```
src/lib/indicators   RSI, MACD, EMA, VWAP, volume, confidence, agreement
src/lib/market       provider interface, Yahoo, simulated feed, dashboard assembly
src/app/api/dashboard
src/components       watchlist, ranked cards, side-by-side board, briefing
```

`GET /api/dashboard?symbols=NVDA,SPY` returns quotes, one signal per symbol per timeframe, the source label, and any per-symbol errors.

The page is a client view over that endpoint. The first paint is a loading shell. Prices are not baked into the static page, which is what Next.js cache components expect for data that changes through the day.

## Tests

```bash
npm test
```

Vitest covers the indicator math (EMA seed, Wilder RSI, MACD sign, VWAP, volume ratio), the confidence formula (a unanimous vote is 100, one loud factor is not, canceling votes are mixed), the agreement sentences, bar aggregation, the Yahoo payload parser, the session clock, and ticker sanitation. Network tests are not part of the suite.

## GitHub Student Developer Pack

Nothing in v1 depends on the pack. Offers change. Check the current list at [education.github.com/pack](https://education.github.com/pack) before counting on one. As of November 2026, these are the relevant ones for a later version of this desk:

- **Microsoft Azure.** $100 credit for eligible students 18+, plus a free-services tier. A reasonable place to host the Next.js app.
- **Heroku.** $13 of monthly credit for 24 months. Enough for a small web dyno while the desk is still one process.
- **MongoDB Atlas.** $50 in credit, plus Compass. Useful once watchlists and signal history need an account instead of `localStorage`.
- **Datadog.** Pro account, 10 servers, for two years. Use it when a real provider is in the path and you want to see failed fetches and slow chart calls.
- **Namecheap `.me`, Name.com, and `.TECH`.** A free domain for a year. `tradehaxai.tech` may already cover the brand. A spare domain is for a staging host, not for v1.
- **GitHub Copilot Student and GitHub Pro.** The tools for building the next slices.

DigitalOcean left the pack on July 31, 2026. Do not treat it as a current student credit.

The pack does not include a market-data vendor. Options flow, unusual options volume, and a licensed real-time feed (Polygon, Tradier, or a specialist tape) are separate from the student benefits.

## Roadmap

1. **Calibrate the score.** Log signals and later outcomes so confidence can become a measured hit rate instead of an agreement formula. Keep the factor breakdown either way.
2. **Stream the tape.** Replace the 25-second poll with a websocket or SSE once the provider supports it. Add a premarket and after-hours switch.
3. **Options flow.** New provider methods for sweeps, unusual options volume, put/call, and opening versus closing prints. The ranked feed should gain a second column, still written in plain language.
4. **Unusual activity.** Relative volume, gaps, and halts on the same watchlist. Dark-pool prints only if a source is actually licensed.
5. **Alerts.** A name crosses a confidence level, or timeframes flip from conflict to agreement.
6. **Accounts.** Persist watchlists and a signal journal. MongoDB Atlas is enough. No login in v1.
7. **Business intelligence.** Hit rate by setup, by timeframe confluence, and by ticker. That is the journal turned into a report, not a second product.
8. **A licensed feed.** Keep `MarketDataProvider`. Point it at a keyed vendor when delayed Yahoo data is no longer good enough. Keys stay in environment variables.

## Disclaimer

TradeHax is research software. It is not a broker, not investment advice, and not a promise that a high score will make money.
