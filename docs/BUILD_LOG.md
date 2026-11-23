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
