# TradeHax worker

Always-on process for option flow, market tide, alerts, NOPE, and off-exchange prints. It serves JSON to the static site, which reads its origin from `NEXT_PUBLIC_WORKER_URL` at build time.

## What it does

- Every `CHAIN_POLL_SEC` (120) it pulls a rotating `CHAIN_BATCH` (8) of `UNIVERSE` or `WORKER_SYMBOLS` (about 50 liquid names by default) straight from `cdn.cboe.com`. The quotes set bid/ask side and delta. Without Alpaca keys, the volume change between two snapshots becomes an inferred print.
- With `ALPACA_KEY_ID` and `ALPACA_SECRET`, every `ALPACA_POLL_SEC` (60) it pulls 15-minute-delayed OPRA trades for the most active `WATCH_CONTRACTS` (400) contracts, plus anything trading above open interest. These are individual prints with exchange and condition codes, so ISO sweeps, blocks, and multi-leg trades are flagged. It also pulls SIP stock trades and keeps TRF (exchange `D`) prints of at least `OFFEX_MIN_NOTIONAL` ($1M).
- On start it backfills the last `BACKFILL_MIN` (30) minutes of the current or most recent session. State is in memory only.

## Routes

`/health` and `/v1/health`, `/v1/flow` and `/v1/interval` (`?symbol=&minPremium=&flag=sweep|block|multileg&limit=`), `/v1/alerts`, `/v1/tide`, `/v1/top-net-impact`, `/v1/hot`, `/v1/ticker/:symbol`, `/v1/history?date=&symbol=`, `/v1/netflow/:symbol`, `/v1/nope/:symbol`, `/v1/offex` (`?symbol=&limit=`), and `/v1/stream`. CORS allows each origin in `ALLOWED_ORIGIN` (comma separated). Set `UNIVERSE` to override the default list of about 50 names. `CHAIN_BATCH` (8) and `STOCK_BATCH` (10) stagger the polls.

## Deploy

The worker imports shared code from `../src/lib`, so it is bundled with esbuild into `dist/server.mjs` and only `Procfile`, `package.json`, and `dist/` are shipped.

- Heroku: `worker/deploy-heroku.sh <app>` with `HEROKU_API_KEY` set. Use a Basic dyno; Eco sleeps. Config vars: `ALPACA_KEY_ID`, `ALPACA_SECRET`, `ALLOWED_ORIGIN=https://darkmodder33.github.io`, `NODE_ENV=production`.
- Azure: the same bundle and `node dist/server.mjs` on a B1s Linux app, with the same settings.

Never put the Alpaca keys in the static site.
