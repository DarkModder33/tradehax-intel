# TradeHax Intel: Build Log

A dated history of what was built, what broke, and how it was fixed. Times are **Eastern (ET)**, taken from commit and run timestamps. SHAs are GitHub `DarkModder33/tradehax-intel` `main`. Origin (`irishmikeflaherty/tradehax-intel`) commits keep **the same SHAs** on GitHub because they arrive through normal merges. A commit marked **[GH]** exists only on GitHub (see [HANDOFF §1](HANDOFF.md#1-two-repo-setup-and-merge-rules)). Run IDs are GitHub Actions runs.

---

## Fri 2026-11-14: v1 desk

| Time | SHA | Change |
|---|---|---|
| 9:16 PM | 43069bd | Initialize project (Next.js) |
| 10:17 PM | 19fe905 | **v1 dashboard.** Watchlist, a ranked signal feed (EMA 9/21, MACD, RSI 14, VWAP, volume votes), side-by-side timeframes, Yahoo through `proxy.cors.dev`, and a labeled demo feed |

## Sun 2026-11-15: static export, parity phases P0–P5, live worker

**Morning: getting onto GitHub Pages**

| Time | SHA | Change |
|---|---|---|
| 11:28 AM | ea0b8ad | Documented a Vercel deploy. Dropped later in favor of Pages, which is free and has no server. |
| 11:41 AM | 6442ae7 | Static export for GitHub Pages (`output: "export"`) |
| 12:30 PM | 50a2cad | Measured hit rates, a CNBC cross-check, and market regime |
| 12:38 PM | 9beaa73 [GH] | Re-ran deploy after switching the Pages source to **GitHub Actions** |
| 12:41 PM | 0384279 [GH] | **Fix:** Pages builds failed (runs 43737902498, 43741743546, 43742253074) because the Turbopack CSS loader could not resolve `tw-animate-css`. Switched to the Tailwind PostCSS plugin. |
| 12:55 PM | 2647d31 | Signal scoring with Wilson intervals, costs, BH correction, and a gated walk-forward logistic |
| 1:22 PM | e6ae900 | Pop-out live tape (Document PiP plus a `/popout/` window fallback). Merged as 1d3c0ed. |
| 1:28 PM | cffa924 [GH] → a91d47f | **Fix:** `/popout/` returned 404 on Pages because `configure-pages` rewrote `next.config.ts` and dropped `trailingSlash`. Fixed for good by moving to **`next.config.mjs`** (a91d47f). |

**Afternoon: options and market-structure parity (from the `tradehax-uw-parity-spec`)**

| Time | SHA | Change |
|---|---|---|
| 5:32 PM | 24c0f1e | **P0** source adapters, DataBadge, and the dataset workflow skeleton |
| 5:34 PM | a5a42f4 | **P1** delayed-chain gamma, volatility, hot contracts, and strategy payoff (Cboe, in the browser) |
| 5:39 PM | f6c8e2c | **P2** precomputed insiders, Congress, shorts, and calendars |
| 5:41 PM | 9ff592e | **P3/P4** flow worker (`worker/`) and delayed stand-ins for live panels. Merged as c4e7e66. |
| 5:47 PM | — | First `data` run failed (43771203206) |
| 5:54 PM | 4ff014d | **Fix:** publish only `data/` on an **orphan `data` branch** (force-added, since it is gitignored on main). Retry Nasdaq and SPDR with a browser UA, and take SPY flows from the NAV workbook. Pages now triggers on `workflow_run` of `data`. Merged as cc849c8. Data run 43772278964 succeeded at 5:59 PM. |
| 6:37 PM | 1d2ff3e | **Heroku worker `tradehax-intel-worker` live.** Flow, tide, and off-ex pages read the live tape. Merged as c2e2d53. |
| 7:31 PM | 3f54010 | Static ticker overview plus a ⌘K search |
| 7:32 PM | 4adede0 | **P5** watchlists and browser alert rules |
| 7:35 PM | 6887adc, 1f52197 | Wider worker universe, `/v1/history`, the map, filings retries, and the data job pulling worker print history. Merged as d334640. |
| 7:38 PM | d040c49 [GH] | `data.yml` falls back to the Heroku URL when `vars.WORKER_URL` is unset |
| 8:11 PM | 7588f24, e1f86a7 | **Custom domain:** a configurable base path, with the site served from the root of **tradehaxai.tech** (F1). Merged as 5904011. DNS: Namecheap domain → Cloudflare zone → Pages A records, `www` CNAME to `darkmodder33.github.io`, HTTPS enforced. |

**Evening: Batch A (from `tradehax-next-batch-spec.md`, prepared at 8:45 PM)**

| Time | SHA | Item |
|---|---|---|
| 8:50 PM | 23aa2bb | **F6** worker `/v1/bars` (Alpaca SIP) and `/v1/chain-summary`, plus a shared chain cache (less reliance on `proxy.cors.dev`) |
| 8:53 PM | d45c3f5 | **A1** Pro Chart (lightweight-charts, studies, gamma overlays) |
| 8:55 PM | fdbc007 | **A3** Strategy builder on the delayed chain |
| 8:57 PM | 36ac6b1 | **A4** IV rank math and an append-only IV history |
| 9:01 PM | 34f108f | **A5** real screener on the Nasdaq universe (the fake preview rows are gone) |
| 9:02 PM | df4bf16 | **A2** backtest lab with next-open fills |
| 9:03 PM | 44cfe1e | **A6** browser-only portfolio and simulated paper book |
| 9:05 PM | 957576e | **A7** grouped nav and an installable PWA shell |
| 9:05 PM | 83e3132, 828ffb0 | **F2** sitemap, robots, a share card, and OG and Twitter fields |
| 9:06 PM | 3faf72d, 74baec2 | **F3** dataset age and market-closed chip. **F4** one `PanelState` for every state. |
| 9:07 PM | 0753d0e | **F8** nightly datasets widened to the liquid universe. Merged as 9324f56. |
| 9:36 PM | 9a822b6 [GH] | **Fix:** the static export **hung** on the chart page and the chain web worker. Added a client chart loader, and split `cboe-parse.ts` to break an import cycle. |
| 9:43 PM | 5a87a14 | **Fix:** Alpaca bars returned an empty "today" window. Now sends a padded start with `sort=desc`, and BRKB becomes BRK.B. Merged as 12ccec9. |
| 9:46 PM | 338bfe5 [GH] | **Fix:** typecheck picked up the generated chain worker copied into `out/`. Excluded it in tsconfig. |

Verification: data runs on schedule succeeded every weekday from Nov 16 through Nov 21, each followed by a successful Pages `workflow_run` deploy.

## Sun 2026-11-22: Batch B and fine-tuning (F5, F9–F16)

| Time | SHA | Item |
|---|---|---|
| 12:48 PM | c9a3efa | **F12** every displayed number goes through the shared formatters |
| 12:49 PM | 0487a3e | **F5** one chart theme for trails, tide, and the sparkline |
| 12:49 PM | 2fc1d0b | **F9** tabbed ticker hub with a watchlist star |
| 12:50 PM | 34061b8 | **F10** mobile tables and controls |
| 12:50 PM | 4149921 | **F11** ▲/▼ glyphs and signs for up and down (color-blind safe) |
| 12:50 PM | f5b6dab | **F13** `/status/` and an expanded `/about/` |
| 12:51 PM | ae8689d | **F14** worker GET caching, 60/min rate limit on heavy routes, history warm on boot |
| 12:51 PM | 5d0fce7 | **F15** named, shareable workspace grids |
| 12:53 PM | 5e6835f | **F16** NOTICE, lint in CI, a first-load JS budget. **LICENSE deferred by Mike.** |
| 12:54 PM | 52433e7 | **B1** unusual-activity score and the contract page `/c/?occ=` |
| 12:54 PM | 4109544 | **B2** earnings implied move, stored only when a chain was observed |
| 12:55 PM | d9c5abe | **B3** relative-strength map and correlation matrix (`/rotation/`) |
| 12:55 PM | 0c3ac47 | **B4** `/macro/` from public FRED CSV |
| 12:55 PM | f75e33d | **B7** 13F info tables and insider cluster buys |
| 12:56 PM | aa56fa7 | **B6** web push that stays off until VAPID and Cloudflare KV keys exist |
| 12:56 PM | 12da5a1 | **B5** in-browser Python lab (Pyodide, loaded on request) |
| 1:03 PM | 325770b | **Fix:** Turbopack stalled on the production build. `npm run build` is now **`next build --webpack`**. |
| 1:04 PM | 93a7bbb | **Fix:** the 350 KB budget blocked deploys, because Next's runtime alone is bigger. Raised to 600 KB, warning only unless `BUDGET_STRICT=1`. Merged as 052ddd7. |
| 1:09 PM | 6061596 [GH] | **Fix:** lint errors (contract-detail state init, PostCSS named export) failed the Pages build |

Verification: Pages push run 45053478641 ✅, data dispatch 45053758950 ✅, Pages `workflow_run` 45054333266 ✅. The worker was redeployed to Heroku.

## Mon 2026-11-23: Batch C (news engine, SEO, social, monetization slots)

Goal (Mike): a site that writes high-interest stock news on its own, ranks in search, posts to social, and earns enough to justify the subscription. Everything stays free.

| Time | SHA | Item |
|---|---|---|
| 1:19 PM | 685db2c | **C0** Cboe delayed option quotes started returning **403**. Added a fallback chain: Cboe with browser headers → Alpaca indicative → Yahoo options. The worker and jobs report which feed answered. |
| 1:26 PM | bd71a90 | **C1** deterministic story engine (`scripts/news/engine.mjs`). No model, thresholds only, 9 story types. |
| 1:30 PM | 06ec06e | **C2** pre-rendered `/news/` pages, ticker and type hubs, RSS and Atom, a Google News sitemap, OG card PNGs (satori and resvg), and IndexNow |
| 1:32 PM | 4df2e96 | **C3** social posting to X, Telegram, and Discord from the data job, with a ledger, a cap, and a dry run |
| 1:33 PM | 0c2a834 | **C4** AdSense, affiliate, newsletter, and Search Console slots that render nothing until configured. Merged as 484c532. |
| 1:39 PM | b10984d [GH] | `social.yml` manual dispatch (`dry_run`, `cap`, `platforms`), plus `SOCIAL_PLATFORMS` filtering. Logs never print secrets. |
| 1:46 PM | 778595c [GH] | **Fix:** the ledger only lived in the runner, so a story could be re-sent. It is now **persisted on the `data` branch** (`social.yml` has `contents: write` and a commit-and-push with rebase retries). `seed-ledger.mjs` records the Discord post that already went out. checkout and setup-node moved to **v7** (Node 24 runtime). |

**Social rollout, Nov 23**

| Time (ET) | Event |
|---|---|
| 1:28 PM | `DISCORD_WEBHOOK_URL` secret set |
| 1:39 PM | Pages deploy 45240712367 ✅ (b10984d) |
| 1:42–1:43 PM | social runs 45241301003 and 45241466026 ✅. **First Discord post** (SECTORS rotation 2026-11-16). |
| 1:46 PM | Pages deploy 45241910821 ✅ (778595c). Dry-run social 45241987813 ✅. v7 actions resolve, and the ledger skip works. |
| 2:51 PM | `TELEGRAM_BOT_TOKEN` set through `gh` (device login as DarkModder33). Bot @hackavellibot. |
| ~3:00 PM | Mike created the Telegram channel "Intel", public link `t.me/tradehsxintel` (a typo of `tradehaxintel`), and made the bot an admin |
| 3:03 PM | `TELEGRAM_CHAT_ID` set (the numeric id, so it survives a rename) |
| 3:07 PM | social run **45255968344** ✅. **First Telegram post verified.** Ledger now reads `SECTORS|rotation|2026-11-16 → [discord, telegram]`. |

Live checks (3:15 PM ET, through `curl --resolve`): `/`, `/news/`, `/news/feed.xml`, `/news-sitemap.xml`, `/sitemap.xml`, `/robots.txt`, `/data/manifest.json`, `/status/`, and `/flow/` all returned 200. Worker `/health` showed `ok:true`, `alpaca:true`, 51 symbols, 15-minute-delayed Alpaca prints with Cboe quotes.

**Open at end of day:** no scheduled `data` run had fired yet on Nov 23, so the `data` branch has no `news/stories.json` and the site shows the 9 seed stories. X keys, push keys, monetization IDs, Search Console, backporting b10984d and 778595c to Origin, and the MIT license (deferred) are all still open. See [HANDOFF §7](HANDOFF.md#7-pending-and-next-tasks).

**Scheduler and P0 audit fixes, Nov 23 (evening)** — full audit in `/workspace/tradehax-audit.md` on the Grok Bot box. All commits are GitHub-only and **need an Origin backport**.

| Time (ET) | SHA | Change |
|---|---|---|
| 3:24 PM | — | Manual data run 45259066540 ✅: first `news/stories.json` on `data` (10 stories), news sitemap 0 → 10, 8 stories posted to Telegram and Discord |
| 3:34 PM | 0b704d3 | Crons moved to odd minutes; `worker-cron/` Cloudflare Worker **tradehax-cron** (free cron, `17,47 12-22 * * 1-5` and `21 13 * * 6` UTC) dispatches `data.yml` when no run started in the last 25 min. Secret `GH_TOKEN` on the Worker. |
| 4:00 PM | 67b2003 | `/chart/` crashed (lightweight-charts cannot parse `oklch()`); chart colours are hex |
| 4:00 PM | c00646c | `/flow/history/` defaulted to 2026-11-13 (always 0 prints); now today in New York |
| 4:00 PM | 9e7daa1 | Lint: named default export in the cron Worker |
| 4:00 PM | c35ce67 | Short interest frozen on 2026-08-14 (rolling 90-day FINRA window), FTD file hard-coded (walk back to newest SEC half-month), FRED all timing out (plain UA), `technicals` job wired into `JOBS`, failed sources keep the last good file, screener DTC field |
| 4:00 PM | d07d301 | Stories keep sentence order, readable ET stamps, no internal wording, max 3 per type per run, stale short rows skipped, seed stories merged so posted URLs stay live |
| 4:00 PM | 5d87809 | News hubs for every type and universe ticker (empty ones noindex); RSS/Atom plain links |
| 4:00 PM | 7d47121 | Doubled titles fixed, per-route canonical, keyword home title |
| 4:00 PM | 8385100 | Dataset tables formatted per file (insiders, Congress, 13F, ETF flows, calendar, seasonality), Polymarket volume |
| 4:04 PM | 74106d8 | `finite(null)` was 0, producing three bogus "+5 point" Treasury stories; fixed and retracted via `content/news/retracted.json` |
| 4:04 PM | 6a49c95 | Social only posts stories from the last 36 h (`SOCIAL_MAX_AGE_HOURS`) |
| 4:07 PM | — | Data run 45266075011 ✅ (2m14s, was 6m34s): 51 technicals, shorts settled 2026-10-30, all 13 FRED series, 25 stories, news sitemap 16 |

**Premium push, Nov 23 (late afternoon)**: Mike approved this push and the Discord cleanup. All commits are GitHub-only and **need an Origin backport**, in this order.

| Time (ET) | SHA | Change |
|---|---|---|
| 4:17 PM | 647d0dc | Discord posts use `?wait=true`. The ledger records `messages[storyId][network] = messageId` for Telegram and Discord, so a bad post can be deleted by id. The 3 false Treasury posts on Discord were sent before this change and have no ids, so **Mike deletes them by hand**. Telegram 14–16 were deleted. |
| 4:21 PM | aca34c1 | Day change on the desk and pop-out: the percent was multiplied by 100 twice (SPY showed ±6–7%), and the move was measured bar to bar. It is now measured against the prior NY-session daily close (`withSessionChange`). |
| 4:31 PM | 1af13cd | Premium shell: sticky blurred nav, ⌘K command palette that also opens tickers, mobile drawer and bottom nav, home hero, market strip (SPY/QQQ/IWM/DIA/TLT/GLD), top stories, and skeleton, empty and error states. 390px overflow went from 302px to 0. |
| 4:37 PM | 55364ee | Congress trades parsed from House PTR PDFs (`pdftotext -layout`, last 120 days, at most 160 docs, cached by docId). Party comes from congress-legislators. `/congress/` page, and Congress trades on each ticker page. Senate eFD is not parsed (agreement cookie). |
| 4:42 PM | 0b01476 | Event-triggered stories: flow spikes (≥2.5× the 5-session average and ≥250k contracts), gamma flips (|net GEX| ≥ $50M), and insider buying clusters (shares and price > 0, within 14 days). `options-history.json` holds a daily options row. `validateStory` plus an input-age gate (36 h) refuse bad stories and log them. Short-interest jumps use the existing `short` type and pass through the same gate. |
| 4:46 PM | f40a82c | GEX heatmap (strike × expiry, labeled, with the flip level) on `/gex/`. The intraday tide chart is an SVG with ET axes, sliced to the latest session. |
| 4:51 PM | 9a924bb | Earnings implied vs actual: Nasdaq report dates and EPS surprise, worker daily closes (close before → first close after the report, which covers both BMO and AMC), and implied from the ATM straddle (Cboe live within 14 days, then Alpaca historical option bars). `/earnings/` has upcoming and history tables. Stories only run when the reaction closed in the last 3 days. |
| 4:54 PM | c3e47f9 | Earnings story wording: ± implied, states the straddle source and expiry, and drops the stale "not backfilled" line. The WMT story went out at 4:53 PM ET with the old wording. Its numbers are correct. |

Data run 45273858568 ✅: congress 1002 rows, earnings-moves 128 rows (32 names, all with an implied), 6 upcoming. Before and after screenshots are on the box in `/workspace/tradehax-shots/{before,after}/`.
