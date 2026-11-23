# tradehax-cron

Backup scheduler for `.github/workflows/data.yml`. GitHub's scheduled runs are delayed or dropped (on Nov 16–23 only 2–3 of ~19 weekday slots fired, often hours late), so this free Cloudflare Worker runs on Cloudflare cron at :17 and :47 past each hour, 12:00–22:59 UTC on weekdays, plus Saturday 13:21 UTC. Each tick lists the last data runs and calls `workflow_dispatch` only if no run was created in the last 25 minutes and none is queued or running.

- Worker: `tradehax-cron` on Mike's Cloudflare account (`mike-flaherty.workers.dev`). `GET /health` reports whether the token is set, never its value.
- Secret: `GH_TOKEN`, a GitHub token for DarkModder33 that can dispatch Actions on this repo (currently the box's `gh` OAuth token with `repo` and `workflow` scopes). Rotate by setting the secret again. Prefer a fine-grained PAT limited to this repo with Actions: read and write.
- Deploy: `npx wrangler deploy` from this folder, then `npx wrangler secret put GH_TOKEN`. It was first deployed through the Cloudflare API on 2026-11-23.
