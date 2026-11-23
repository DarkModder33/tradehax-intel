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

Open [http://localhost:3000/](http://localhost:3000/). The site is served from the domain root.

Copy `.env.example` to `.env.local` only if you want to force the simulated feed. The default needs no key.

```bash
# .env.local
NEXT_PUBLIC_MARKET_DATA_PROVIDER=yahoo
```

Set `NEXT_PUBLIC_MARKET_DATA_PROVIDER=mock` to force the simulated feed. The screen labels that feed **Demo data**. It never presents simulated prices as the market.

## Deploy

The live site is a static export on GitHub Pages:

[https://tradehaxai.tech/](https://tradehaxai.tech/)

Pushing to `main` on [DarkModder33/tradehax-intel](https://github.com/DarkModder33/tradehax-intel) runs `.github/workflows/deploy.yml`. That workflow installs, tests, runs `npm run build`, and deploys the `out` directory with the official Pages actions. In the repo settings, Pages must use the **GitHub Actions** source.

No environment variables are required on Pages. Optional:

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_MARKET_DATA_PROVIDER` | `yahoo` (default) or `mock` for the labeled simulated feed |
| `POLYGON_API_KEY`, `FINNHUB_API_KEY`, `TRADIER_API_KEY` | Unused in v1. Leave them unset. Do not put keys in client code. |

`basePath` and `assetPrefix` come from `NEXT_PUBLIC_BASE_PATH`. Unset, the site is served from `/`. Set the variable only if Pages is mounted under a project path. Images are unoptimized because Pages has no Next image server.

## Data source

v1 reads [Yahoo Finance's public chart endpoint](https://query1.finance.yahoo.com/v8/finance/chart/) (`/v8/finance/chart/{symbol}`). No API key. The browser cannot call that host directly, because Yahoo does not send `Access-Control-Allow-Origin`. The client loads it through the keyless [cors.dev](https://proxy.cors.dev/) GET proxy, which does. Quotes can be delayed, and the Yahoo endpoint is unofficial, so it can change or rate-limit.

If every requested symbol fails, the page falls back to the simulated feed and says why. A single bad ticker stays as an error on that row. The rest of the book still scores.

Market data goes through `MarketDataProvider` in `src/lib/market/provider.ts`. The browser Yahoo provider (`src/lib/market/yahoo.ts`) and the demo feed (`src/lib/market/mock.ts`) both implement it. Scoring runs in the browser. A later vendor replaces `loadDashboard` in `src/lib/market/dashboard.ts` without a UI rewrite. Chart responses are cached in memory for the open tab (about 30 seconds for 1-minute bars, longer for slower timeframes). 4h bars are built by folding 1h bars.

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

Each live card also shows a measured history line. The legacy vote is replayed on older bars. A position is entered only when the absolute score reaches 0.60, and it is filled at the next bar's open, not the signal close. It is scored over the next 5 bars (1m), 6 bars (5m), 4 bars (15m and 1h), 3 bars (4h), or 5 bars (1D), after a round-trip cost. The line quotes a Wilson 95% interval, a beta-binomial shrink toward 50%, the sample size, and gross versus net expectancy in basis points. "Significant" appears only when the Wilson lower bound is above 50% and the cell survives Benjamini–Hochberg at q = 0.10 across the symbol, timeframe, and direction cells. Otherwise the card says "Not significant." A walk-forward L2 logistic combiner is fit on the same bars and is adopted only when its out-of-sample log loss and Brier score beat both the base rate and the legacy vote. The track-record line shows the trial count and a deflated Sharpe. Live calls are stored in this browser and scored the same way once those forward bars exist.

A **Pop out** button on the desk and on each card opens a compact live tape. Chromium browsers (Chrome, Edge, Opera, and other Chromium shells from version 116) use the Document Picture-in-Picture API, which floats an always-on-top window. Firefox and Safari do not support that API, so the same button opens a normal resizable window at `/popout/?symbols=SPY,NVDA&tf=5m`. That page is part of the static export and works on its own. Both windows share the latest briefing over `BroadcastChannel` when the desk is open, and the pop-out fetches for itself when it is the only window. The symbol list, timeframe, and the optional flip sound (off until you turn it on) are stored in `localStorage`. Opening the link applies its query; a reload keeps the last choice made in the window.

The desk also loads a second price source, CNBC's public charts, to fill a symbol Yahoo missed and to flag last prices that differ by more than 1.5%. VIX, SPY, and QQQ daily charts from CNBC set a risk-on or risk-off note. Sector ETFs are ranked against SPY over 20 days. Bitcoin and Ethereum come from CoinGecko. Headlines come from Yahoo's public search endpoint through the same keyless proxy. Earnings dates are labeled unavailable: no keyless browser calendar responded. Stooq did not send CORS headers, so it is not used.

## Options and market structure

Gamma, the chain, volatility, hot contracts, and the strategy calculator run in the browser on Cboe delayed chains. Insiders, Congress, short interest, fails-to-deliver, and seasonality are precomputed JSON in `public/data`. Flow, tide, and off-exchange prints say "live feed not connected" until `NEXT_PUBLIC_WORKER_URL` points at the worker in `worker/`. That process is not deployed from this repo.

## Architecture

```
src/lib/indicators   RSI, MACD, EMA, VWAP, volume, confidence, agreement
src/lib/market       provider interface, browser Yahoo fetch, simulated feed
src/components       watchlist, ranked cards, side-by-side board, briefing
```

The page is a static shell. After it loads, the browser fetches prices and scores them. There is no Next.js server and no API route in the Pages build.

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

1. **Regime weights and a momentum-crash guard.** Reweight the vote when VIX is stressed, and stand down when a sharp rally follows a deep drawdown. Not in this build.
2. **Meta-labeling.** A second model that decides whether to take the legacy call, once a few hundred out-of-sample events exist. Not in this build.
3. **Nightly model fit.** Precompute the daily logistic in GitHub Actions and ship the coefficients with the static export, so the browser does not refit on every refresh.
4. **Stream the tape.** Replace the 25-second poll with a websocket or SSE once the provider supports it. Add a premarket and after-hours switch.
5. **Options flow.** New provider methods for sweeps, unusual options volume, put/call, and opening versus closing prints. The ranked feed should gain a second column, still written in plain language.
6. **Unusual activity.** Relative volume, gaps, and halts on the same watchlist. Dark-pool prints only if a source is actually licensed.
7. **Alerts.** A name crosses a confidence level, or timeframes flip from conflict to agreement.
8. **Accounts.** Persist watchlists and a signal journal. MongoDB Atlas is enough. No login in v1.
9. **Business intelligence.** Hit rate by setup, by timeframe confluence, and by ticker. That is the journal turned into a report, not a second product.
10. **A licensed feed.** Keep `MarketDataProvider`. Point it at a keyed vendor when delayed Yahoo data is no longer good enough. Keys stay in environment variables.

## News

`node scripts/news/generate.mjs` writes `content/news/stories.json` from the files in `public/data` (or `DATA_DIR`). A story is kept only when a stored figure clears a fixed threshold. Earnings, IV rank, 13F, and insider cluster pages stay empty until those files have the rows the filter requires.

Weekday data runs also generate stories around the open, midday, and the close. The Pages build copies `data/news/stories.json` from the data branch before `next build`, then writes RSS at `/news/feed.xml`, Atom at `/news/atom.xml`, a Google News sitemap of the last 48 hours at `/news-sitemap.xml`, and card images under `/news/og/`. IndexNow pings only when `INDEXNOW=1`, and a failed ping does not fail the job. The public key file is `public/a7c3e91b4d2f48e0a1b6c5d4e3f2a190.txt`.

Ads, the affiliate list, the newsletter form, and the Search Console meta tag render nothing until `NEXT_PUBLIC_ADSENSE_CLIENT` plus `NEXT_PUBLIC_ADSENSE_SLOT`, rows in `content/affiliates.json`, `NEXT_PUBLIC_NEWSLETTER_URL`, or `NEXT_PUBLIC_GSC_VERIFICATION` are set. `ads.txt` is written only for a `ca-pub-` client. Affiliate links use `rel="sponsored nofollow"`. The affiliate file ships empty.

The same data job posts each new material story to X, Telegram, and Discord. `SOCIAL_AUTOPOST` defaults to 1. An adapter runs only when its secrets are set: X needs `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and `X_ACCESS_SECRET` (API v2, OAuth 1.0a user context); Telegram needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; Discord needs `DISCORD_WEBHOOK_URL` and receives a rich embed with the card image. Posted ids are stored in `data/social-posted.json` on the data branch so a later run does not send the same story twice. The step caps each run (`SOCIAL_CAP`, default 8), backs off when X returns 429, and logs a failed post without failing the job. `SOCIAL_DRYRUN=1` logs the text and does not post. Bluesky and Mastodon are stubbed. Do not put these secrets in the repo.

## Disclaimer

TradeHax is research software. It is not a broker, not investment advice, and not a promise that a high score will make money.
