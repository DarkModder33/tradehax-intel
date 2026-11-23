// tradehax-cron: backup trigger for the data workflow.
// GitHub's own cron drops or delays many slots. This Worker runs on Cloudflare's
// free cron and calls workflow_dispatch when no data run has started recently.
// Secret: GH_TOKEN (a token with actions:write on the repo). Never logged.
const REPO = "DarkModder33/tradehax-intel";
const WORKFLOW = "data.yml";
const RECENT_MIN = 25;

async function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "tradehax-cron",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
}

async function tick(env, reason) {
  if (!env.GH_TOKEN) return { ok: false, action: "no-token" };
  const res = await gh(env, `/actions/workflows/${WORKFLOW}/runs?per_page=5`);
  if (!res.ok) return { ok: false, action: "list-failed", status: res.status };
  const { workflow_runs: runs = [] } = await res.json();
  const cutoff = Date.now() - RECENT_MIN * 60_000;
  const recent = runs.find((r) => Date.parse(r.created_at) >= cutoff || r.status === "queued" || r.status === "in_progress");
  if (recent) return { ok: true, action: "skip", reason, recent: { id: recent.id, event: recent.event, status: recent.status, created: recent.created_at } };
  const d = await gh(env, `/actions/workflows/${WORKFLOW}/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main" }) });
  return { ok: d.status === 204, action: "dispatched", reason, status: d.status };
}

const handler = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env, `cron ${event.cron}`).then((r) => console.log(JSON.stringify(r))));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, repo: REPO, workflow: WORKFLOW, hasToken: Boolean(env.GH_TOKEN) });
    }
    return new Response("tradehax-cron", { status: 404 });
  },
};

export default handler;
