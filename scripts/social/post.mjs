import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { storyPath } from "../news/engine.mjs";

const SITE = "https://tradehaxai.tech";
const X_URL = "https://api.x.com/2/tweets";

export function percentEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!*'()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function oauthHeader({ method, url, consumerKey, consumerSecret, token, tokenSecret, nonce, timestamp }) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const pairs = Object.entries(oauth).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`);
  const base = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(pairs.join("&"))}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(base).digest("base64");
  const signed = { ...oauth, oauth_signature: signature };
  const header = Object.entries(signed).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`).join(", ");
  return `OAuth ${header}`;
}

function cashtag(story) {
  if (/^[A-Z]{1,5}$/.test(story.ticker)) return `$${story.ticker}`;
  const other = (story.tickers ?? []).find((ticker) => /^[A-Z]{1,5}$/.test(ticker));
  return other ? `$${other}` : "";
}

export function xText(story) {
  const url = `${SITE}${storyPath(story)}`;
  const tag = cashtag(story);
  const tail = [tag, url].filter(Boolean).join(" ");
  const room = Math.max(0, 270 - tail.length - 1);
  const head = String(story.headline ?? "").slice(0, room).trim();
  return `${head} ${tail}`.trim();
}

/** @param {Record<string, string | undefined>} [env] */
export function configuredAdapters(env = process.env) {
  const adapters = [];
  if (env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET) adapters.push("x");
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) adapters.push("telegram");
  if (env.DISCORD_WEBHOOK_URL) adapters.push("discord");
  return adapters;
}

async function withBackoff(run, sleep) {
  let last = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await run();
    if (response.status !== 429) return response;
    last = response;
    const retry = Number(response.headers?.get?.("retry-after"));
    const wait = Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 20_000) : Math.min(1000 * 2 ** attempt, 20_000);
    await sleep(wait);
  }
  return last;
}

async function postX(story, env, fetcher, sleep) {
  const text = xText(story);
  const nonce = randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = oauthHeader({
    method: "POST",
    url: X_URL,
    consumerKey: env.X_API_KEY,
    consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN,
    tokenSecret: env.X_ACCESS_SECRET,
    nonce,
    timestamp,
  });
  const response = await withBackoff(() => fetcher(X_URL, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({ text }),
  }), sleep);
  if (!response.ok) throw new Error(`x ${response.status}`);
  return text;
}

async function postTelegram(story, env, fetcher) {
  const url = `${SITE}${storyPath(story)}`;
  const text = `${story.headline}\n\n${story.dek}\n\n${url}\n\n${story.disclaimer ?? ""}`.trim();
  const response = await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: false }),
  });
  if (!response.ok) throw new Error(`telegram ${response.status}`);
  return text;
}

async function postDiscord(story, env, fetcher) {
  const url = `${SITE}${storyPath(story)}`;
  const body = {
    embeds: [{
      title: story.headline,
      description: story.dek,
      url,
      color: 14010334,
      image: { url: `${SITE}/news/og/${story.slug}.png` },
      footer: { text: story.disclaimer ?? "Auto-generated from market data — not investment advice" },
    }],
  };
  const response = await fetcher(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`discord ${response.status}`);
  return body;
}

async function send(network, story, env, fetcher, sleep) {
  if (network === "x") return postX(story, env, fetcher, sleep);
  if (network === "telegram") return postTelegram(story, env, fetcher);
  if (network === "discord") return postDiscord(story, env, fetcher);
  throw new Error(`unknown ${network}`);
}

export async function postQueue(options = {}) {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const log = options.log ?? ((line) => console.log(line));
  const results = [];
  try {
    if (env.SOCIAL_AUTOPOST === "0") {
      log("social: SOCIAL_AUTOPOST=0, nothing posted");
      return { ok: true, results };
    }
    const adapters = options.adapters ?? configuredAdapters(env);
    log("social: bluesky stubbed, mastodon stubbed");
    if (!adapters.length) {
      log("social: no X, Telegram, or Discord secrets, nothing posted");
      return { ok: true, results };
    }
    const source = path.resolve(options.newsFile ?? env.NEWS_FILE ?? path.join(process.cwd(), "content", "news", "stories.json"));
    const payload = JSON.parse(await readFile(source, "utf8"));
    const ledgerPath = path.resolve(options.ledger ?? env.SOCIAL_LEDGER ?? path.join(process.cwd(), "data", "social-posted.json"));
    let ledger = { posted: {} };
    try {
      ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
      ledger.posted ??= {};
    } catch {
      ledger = { posted: {} };
    }
    const cap = Number(options.cap ?? env.SOCIAL_CAP ?? 8);
    const dry = env.SOCIAL_DRYRUN === "1" || options.dryRun === true;
    const pending = (payload.stories ?? []).filter((story) => story.passedMateriality === true && adapters.some((network) => !(ledger.posted[story.id] ?? []).includes(network)));
    const batch = pending.slice(0, Number.isFinite(cap) && cap > 0 ? cap : 8);
    for (const story of batch) {
      for (const network of adapters) {
        if ((ledger.posted[story.id] ?? []).includes(network)) continue;
        if (dry) {
          log(`social dry-run ${network} ${story.id}: ${network === "x" ? xText(story) : story.headline}`);
          results.push({ id: story.id, network, dryRun: true });
          continue;
        }
        try {
          await send(network, story, env, fetcher, sleep);
          ledger.posted[story.id] = [...new Set([...(ledger.posted[story.id] ?? []), network])];
          results.push({ id: story.id, network, ok: true });
          log(`social posted ${network} ${story.id}`);
          if (network === "x") await sleep(1100);
        } catch (error) {
          results.push({ id: story.id, network, ok: false, error: error instanceof Error ? error.message : String(error) });
          log(`social failed ${network} ${story.id}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    if (!dry && results.some((row) => row.ok)) {
      ledger.updatedAt = new Date().toISOString();
      await mkdir(path.dirname(ledgerPath), { recursive: true });
      await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    }
    return { ok: true, results };
  } catch (error) {
    log(`social: ${error instanceof Error ? error.message : error}`);
    return { ok: false, results };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await postQueue();
  process.exit(0);
}
