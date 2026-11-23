# TradeHax Intel: Handoff Guide

_Last updated Monday, November 23, 2026, 3:30 PM ET. Written for whoever picks this repo up next, whether another Grok Bot, a coding agent, or a human developer. Every statement here was checked against the code, `gh`, the Heroku API, or the live site on that date._

**Owner:** Mike (Michael O'Flaherty). GitHub `DarkModder33` (deploy repo) and `irishmikeflaherty` (Origin repo).
**Goal:** a free competitor to Unusual Whales at https://tradehaxai.tech that publishes market stories automatically, ranks in search, and drives traffic through social. **Hard constraint: everything stays on free tiers.** Mike has the GitHub Student Developer Pack.

---

## 1. Two-repo setup and merge rules

| Repo | Role | Who writes |
|---|---|---|
| **Origin:** `irishmikeflaherty/tradehax-intel` (Cursor Origin) | **Source of truth for features.** | The Origin cloud coding agent `bc-60393dc8-0d94-5b27-a6e4-8c9b9ec51beb` builds each spec item as its own commit with tests. |
| **GitHub:** `DarkModder33/tradehax-intel` | **Deploy mirror.** Pages, Actions, secrets, and the `data` branch live here. | The mirror agent `bc-1cfe7693-e79f-568e-86ca-69a7a8235d9c` merges Origin `main` into GitHub `main`, plus small GitHub-only fixes. |

**Merge rules**

1. Merge Origin `main` into GitHub `main` with a **normal merge commit** titled `Merge Origin main <sha> into GitHub main.` Never force-push and never rebase GitHub `main`. Origin SHAs are kept as-is in GitHub history.
2. **Keep the GitHub-only fixes.** On a conflict, keep GitHub's side for workflows and for anything listed below, unless Origin has deliberately taken that fix over.
3. After each merge, watch the Pages run (`gh run list -R DarkModder33/tradehax-intel`) and check the live site. From the box, use the `--resolve` trick in §6.
4. If the merge touched `worker/`, redeploy the worker (§4).

**Commits that exist only on GitHub** (Co-authored-by DarkModder33):

| SHA | Why | Status in Origin |
|---|---|---|
| 9beaa73 | Re-ran Pages after switching the Pages source to GitHub Actions | n/a |
| 0384279 | Tailwind PostCSS plugin so the export resolves `tw-animate-css` | check on the next merge |
| cffa924 | pop-out trailing slash on Pages | superseded by Origin a91d47f (`next.config.mjs`) |
| d040c49 | `data.yml` falls back to the Heroku worker URL when `vars.WORKER_URL` is unset | GitHub-only |
| 9a822b6 | static export hung on the chart and the chain worker (client chart loader, `cboe-parse.ts`) | Origin did similar work in 325770b |
| 338bfe5 | keep the generated chain worker in `out/` from being typechecked (tsconfig) | GitHub-only |
| 6061596 | Pages lint fixes (contract-detail state, PostCSS named export) | GitHub-only |
| b10984d | `social.yml` dispatch workflow (dry_run, cap, platforms) and `SOCIAL_PLATFORMS` in `post.mjs` | **needs backport** |
| **778595c** | **Ledger persisted on the `data` branch:** new `scripts/social/seed-ledger.mjs`, `social.yml` gets `permissions: contents: write` and a "Persist ledger" step with rebase retries, `data.yml` runs seed-ledger before post, and checkout/setup-node move to **v7** in all three workflows | **needs backport** |

> **Open task:** backport b10984d and 778595c into Origin through `bc-60393dc8`, so the next mirror merge does not conflict with them or drop them.

---

## 2. Where state lives

| State | Location |
|---|---|
| Code | GitHub `main` (deploys) and Origin `main` (features) |
| Precomputed datasets | Orphan branch **`data`**, folder `data/`: `ats, calendar, congress, earnings-moves, etf-flows, flow-history, ftd, insiders, institutions, iv, iv-history, macro, manifest, oi-change, oi-snapshot, screener, shorts, seasonality, universe, social-posted` (`.json`), plus `news/stories.json` once a data run has generated news. `/data` is gitignored on `main`. Workflows use `git add -f`. |
| Seed datasets for local dev | `public/data/*.json` on `main` |
| News | `data` branch `data/news/stories.json`. If that file is missing, the build falls back to `content/news/stories.json` on `main` (9 seed stories generated Nov 23). |
| Social ledger | `data` branch `data/social-posted.json`, in the form `{ posted: { "<storyId>": ["discord","telegram",...] }, updatedAt }` |
| Live flow state | In memory on the Heroku dyno. It is warmed from `/data/flow-history.json` on boot (F14). |
| Browser user state | `localStorage` and IndexedDB: watchlists, alerts, portfolio, workspace layouts, chain cache |
| Built site | GitHub Pages (Actions source), custom domain `tradehaxai.tech`, HTTPS enforced |
| Specs and research (box only) | `/workspace/tradehax-uw-parity-spec.md` (P0–P6 parity map), `/workspace/tradehax-next-batch-spec.md` (Batch A, Batch B, F1–F16), `/workspace/tradehax-engine-research.md` |

---

## 3. Secrets and environment

**Names only. Never commit or paste values.** Checked with `gh secret list`, `gh variable list`, and the Heroku config-vars API (names only) on 2026-11-23.

### GitHub Actions secrets (`DarkModder33/tradehax-intel`)

| Name | Status | Used by |
|---|---|---|
| `ALPACA_KEY_ID` | ✅ set (updated 2026-11-23 2:51 PM ET) | data.yml (option-chain fallback, technicals) |
| `ALPACA_SECRET` | ✅ set (updated 2026-11-23 2:51 PM ET) | data.yml |
| `DISCORD_WEBHOOK_URL` | ✅ set (2026-11-23 1:28 PM ET) | data.yml, social.yml |
| `TELEGRAM_BOT_TOKEN` | ✅ set (2026-11-23 2:51 PM ET), bot **@hackavellibot** | data.yml, social.yml |
| `TELEGRAM_CHAT_ID` | ✅ set (2026-11-23 3:03 PM ET), the channel's **numeric** id | data.yml, social.yml |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | ❌ unset | X adapter. It needs all four: OAuth 1.0a user context with Read and Write permissions. |
| `SEC_USER_AGENT` | ❌ unset (falls back to a default UA) | SEC EDGAR jobs. SEC wants a real contact. |
| `FINNHUB_KEY`, `FRED_KEY` | ❌ unset (optional) | data.yml (macro uses the public FRED CSV without a key) |
| `WORKER_PUBLISH_TOKEN` | ❌ unset on GitHub (it **is** set on Heroku) | data.yml → worker |

### GitHub Actions variables

**None are set.** `gh variable list` is empty. Every workflow default applies:

| Name | Default when unset |
|---|---|
| `WORKER_URL` | `https://tradehax-intel-worker-bf2f623ce81a.herokuapp.com` |
| `PAGES_BASE_PATH` | `''` (root domain) |
| `SOCIAL_AUTOPOST` / `SOCIAL_DRYRUN` / `SOCIAL_CAP` | `1` / `0` / `8` |
| `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT` | ❌ unset, so ad slots and `ads.txt` render nothing |
| `NEXT_PUBLIC_NEWSLETTER_URL` | ❌ unset, so there is no newsletter form |
| `NEXT_PUBLIC_GSC_VERIFICATION` | ❌ unset, so there is no Search Console meta tag |

`INDEXNOW` is not a secret or a variable. `data.yml` sets `INDEXNOW: "1"` inline, so IndexNow pings are **on** for data runs. The key is public by design: `a7c3e91b4d2f48e0a1b6c5d4e3f2a190`, served at `/a7c3e91b4d2f48e0a1b6c5d4e3f2a190.txt`. `BUDGET_STRICT` is unset, so the budget only warns.

### Heroku `tradehax-intel-worker` (web, **Basic** dyno ×1)

| Name | Status |
|---|---|
| `ALPACA_KEY_ID`, `ALPACA_SECRET`, `ALLOWED_ORIGIN`, `NODE_ENV`, `WORKER_PUBLISH_TOKEN` | ✅ set |
| `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`, `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN` | ❌ unset. `/v1/push/key` reports push as "coming soon". All six are needed. |
| Tuning (`UNIVERSE`, `CHAIN_POLL_SEC`, …) | unset, so defaults apply (51-symbol universe) |

`ALLOWED_ORIGIN` should stay `https://tradehaxai.tech,https://www.tradehaxai.tech,https://darkmodder33.github.io`.

### Box-only (the Grok Bot box, not the repo)

- `HEROKU_API_KEY` is in the box shell environment and is used by `worker/deploy-heroku.sh`. Never echo it.
- `/workspace/.tg/token` holds a copy of the Telegram bot token (mode 600). It was already pushed to GitHub secrets.
- `gh` CLI (`/usr/local/bin/gh`) is logged in as DarkModder33 with `repo` and `workflow` scopes, through the device flow.
- GitHub MCP (`user-GitHub-xai`) can dispatch workflows and read runs and logs, but it **cannot write secrets**. Use `gh secret set NAME -R DarkModder33/tradehax-intel < file`.

---

## 4. Runbooks

**Redeploy the worker** (after any `worker/` or shared `src/lib` change):

```bash
cd /workspace/tradehax-gh && git fetch -q && git reset -q --hard origin/main \
  && (cd worker && npm i esbuild --no-save) \
  && bash worker/deploy-heroku.sh tradehax-intel-worker
```

`reset --hard` wipes the `--no-save` esbuild install, so reinstall it **every time**. The script prints a build id and an output stream URL. Afterwards, check `curl -s https://tradehax-intel-worker-bf2f623ce81a.herokuapp.com/health`. Expect `"ok":true`, `"alpaca":true`, and `universeSize` 51.

**Refresh data and news now:** `gh workflow run data.yml -R DarkModder33/tradehax-intel`. When it succeeds, it starts the Pages deploy.

**Post to social by hand:**
```bash
gh workflow run social.yml -R DarkModder33/tradehax-intel -f dry_run=1 -f cap=1 -f platforms=discord,telegram   # preview
gh workflow run social.yml -R DarkModder33/tradehax-intel -f dry_run=0 -f cap=1 -f platforms=telegram           # real
```
Logs show `social skip <net> <id>: already in ledger` for stories that were already sent.

**Add or rotate a secret:** `gh secret set NAME -R DarkModder33/tradehax-intel` (it reads from stdin, so pipe from a file and do not paste the value into chat).

---

## 5. Social channels

**Standing permission (from Mike):** auto-post **every TradeHax story** to **X, Telegram, and Discord** without asking. It covers only TradeHax stories and only those three platforms.

| Channel | Status | Details |
|---|---|---|
| Discord | ✅ live | Webhook in `DISCORD_WEBHOOK_URL`. First post: the "SECTORS rotation 2026-11-16" story on Nov 23, through social.yml on b10984d. Seeded into the ledger by `seed-ledger.mjs`. |
| Telegram | ✅ live | Channel **"Intel"**, public link **`t.me/tradehsxintel`**. That spelling is a typo, and Mike may rename it to `tradehaxintel`. Posting uses the **numeric chat id**, so a rename does not break anything. Bot **@hackavellibot** (display name "tradehax") is a channel admin with Post Messages. **First post verified Nov 23, 2026, about 3:07 PM ET, in run 45255968344.** |
| X | ⏳ waiting on keys | Adapter is built (`post.mjs`, API v2 `POST /2/tweets`, OAuth 1.0a, $CASHTAG plus link, under 270 characters). It needs the four `X_*` secrets from the X developer portal. Check the free-tier posting limits. |
| Bluesky, Mastodon | stubbed | — |

The ledger (`data/social-posted.json`) records the networks posted per story id. Since 647d0dc it also records `messages[storyId] = {telegram, discord}` message ids. Discord is posted with `?wait=true` so the id comes back. To retract a post, delete it by that id.

---

## 6. Known gotchas

1. **The box can't resolve tradehaxai.tech normally** (DNS returns a fake IP). Test with `curl --resolve tradehaxai.tech:443:185.199.108.153 https://tradehaxai.tech/`. Pages IPs are 185.199.108–111.153. DNS is on Cloudflare (`amalia` and `rodrigo` nameservers): the apex has A records to GitHub Pages, and `www` is a CNAME to `darkmodder33.github.io`. The domain is registered at Namecheap. The box browser is **not** signed in to GitHub.
2. **`next.config` must stay `.mjs`.** `configure-pages` rewrites a `.ts` config and drops `trailingSlash` (a91d47f).
3. **Use `next build --webpack`.** Turbopack stalls on the production export (325770b). The chart page has to load its client chart through a client component (`chart-loader.tsx`), not `next/dynamic` with `ssr:false` in a server page.
4. **Bundle budget is 600 KB** and only warns, unless `BUDGET_STRICT=1`. An earlier 350 KB hard limit failed deploys, because Next's shared runtime alone is larger (93a7bbb).
5. **Lint runs in Pages CI** before the tests, so a lint error blocks the deploy (6061596).
6. **Cboe returns 403** to datacenter IPs at times. The fallback chain is Cboe with browser headers, then Alpaca indicative, then Yahoo (685db2c, `src/lib/sources/chain-feeds.ts`, `scripts/data/option-chain.mjs`).
7. **Alpaca bars:** ask for a padded start window with `sort=desc`. A "today only" window comes back empty before the open. `BRKB` must be sent as `BRK.B` (Alpaca) or `BRK-B` (Yahoo) (5a87a14).
8. **`data` is an orphan branch** that holds only `data/`. A `data`-branch push made with the default token does **not** trigger workflows, which is why `deploy.yml` listens for `workflow_run` on `data` (4ff014d).
9. **GitHub cron is unreliable** (fixed Nov 23 with odd-minute crons plus the Cloudflare Worker `tradehax-cron` in `worker-cron/`, which dispatches `data.yml` at :17/:47 when no run started in the last 25 minutes; its `GH_TOKEN` secret is the `gh` OAuth token and should be swapped for a fine-grained PAT scoped to this repo). Original note: About 19 weekday slots are configured (UTC `15 12`, `30 13`, and every 30 minutes from 14:00 to 21:30, plus `30 22`), but only 2–3 data runs a day actually fired (Nov 16–21). **As of Mon Nov 23, 3:15 PM ET, no scheduled data run had fired that day**, and the `data` branch does not yet contain `news/stories.json`. The site is showing the seed stories from `content/news/stories.json`, and `/news-sitemap.xml` is empty because none of them are under 48 hours old. If schedules stay quiet, dispatch `data.yml` by hand, or add an external trigger (for example a free Cloudflare Worker cron that calls `workflow_dispatch`).
10. **`scripts/data/run.mjs` ignores `--job`.** Every data run builds every dataset.
11. **Heroku** restarts dynos daily. The worker re-warms its history from the site's `flow-history.json`. Eco dynos sleep, so it stays on **Basic**.
12. **Dependabot Updates** runs fail (dynamic). This is harmless and unrelated to deploys.
13. **AGENTS.md** says this Next.js (16.4) has breaking changes. Read `node_modules/next/dist/docs/` before changing framework-level code.
14. **Data honesty rule:** never fabricate numbers. Every panel shows a DataBadge (source, as-of, delay), and inferred values carry an INFERRED chip.

---

## 7. Pending and next tasks

| # | Task | Blocked on |
|---|---|---|
| 1 | Backport GitHub-only b10984d and 778595c (social.yml, seed-ledger, ledger persistence, actions v7) to Origin | Origin agent `bc-60393dc8` |
| 2 | X posting: add `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | Mike creates the X developer app |
| 3 | Web push: VAPID keypair plus a Cloudflare KV namespace and an API token, set as Heroku config vars | Keys |
| 4 | Monetization: `NEXT_PUBLIC_ADSENSE_CLIENT` and `_SLOT`, `NEXT_PUBLIC_NEWSLETTER_URL`, and affiliate rows in `content/affiliates.json` | Mike's account IDs |
| 5 | Google Search Console: set `NEXT_PUBLIC_GSC_VERIFICATION`, then submit `/sitemap.xml` and `/news-sitemap.xml` | Mike's GSC property |
| 6 | ~~Make the data and news schedule reliable~~ done Nov 23 (gotcha 9). Backport the Nov 23 evening GitHub-only commits listed in BUILD_LOG to Origin. | Origin agent |
| 7 | **MIT LICENSE**: deferred by Mike. Do not add it until he says so. | Mike |
| 9 | Delete the 3 false Treasury (DGS2/DGS10/DGS30) posts on Discord by hand. They predate message-id logging. | Mike |
| 12 | Backport the v2 commits (3433b80, d3b48a0, 5afa3ce, 7ad5a32, b1661a3, and the docs commit) to Origin | Origin agent |
| 13 | Alert posting knobs (repo variables): `SOCIAL_ALERTS=0` turns it off; `SOCIAL_ALERT_CAP` (5) and `SOCIAL_ALERT_DAY_CAP` (30) | — |
| 10 | Backport the premium push (647d0dc, aca34c1, 1af13cd, 55364ee, 0b01476, f40a82c, 9a924bb, c3e47f9, and the docs commit) to Origin | Origin agent |
| 11 | Senate trades: eFD needs the agreement cookie flow. Push alerts and 13F are deferred. | — |
| 8 | Optional: `SEC_USER_AGENT` with a real contact, and rename the Telegram link to `tradehaxintel` | — |

Ideas past these: regime weights, meta-labeling, a nightly model fit, Senate filings, and Polymarket and crypto whale extras (spec P6).
