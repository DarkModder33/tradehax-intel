// Posts new alerts to Telegram and Discord as compact one-liners.
// Run with: node --experimental-strip-types scripts/social/alerts.mjs
// Rate-capped per run and per day, deduped through the shared social ledger, and every
// alert passes validateAlert again right before it is sent.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatAlertLine, validateAlert } from "../../src/lib/alerts/feed.ts";
import { discordWaitUrl } from "./post.mjs";

const SITE = "https://tradehaxai.tech";
const TAPE = new Set(["sweep", "block"]);

export const ALERT_POST_RULES = {
  perRun: 5,
  perDay: 30,
  tapeMinPremium: 1_000_000,
  tapeMaxAgeMinutes: 90,
  seenMaxAgeMinutes: 120,
  eventMaxAgeDays: 3,
};

function nyDay(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function ledgerKey(alert) {
  return `alert:${alert.id}`;
}

/** Which alerts to send this run, in order. Pure, so it is tested without a network. */
export function pickAlerts(alerts, ledger, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const rules = { ...ALERT_POST_RULES, ...(options.rules ?? {}) };
  const day = nyDay(now.getTime());
  const sentToday = Number(ledger?.alertDays?.[day] ?? 0);
  const room = Math.max(0, Math.min(rules.perRun, rules.perDay - sentToday));
  if (!room) return [];
  const posted = ledger?.posted ?? {};
  const seenKeys = new Set();
  const BASE = { "gamma-flip": 15, insider: 12, earnings: 12, "flow-spike": 12, congress: 8, short: 6 };
  const weight = (alert) => {
    if (TAPE.has(alert.type)) return Number(alert.amount) / 1e6;
    if (alert.type === "mover") return Math.abs(parseFloat(String(alert.value))) || 0;
    return BASE[alert.type] ?? 5;
  };
  const perType = new Map();
  const eligible = [...(alerts ?? [])].sort((a, b) => weight(b) - weight(a)).filter((alert) => {
    if (validateAlert(alert, now).length) return false;
    if ((posted[ledgerKey(alert)] ?? []).length) return false;
    const at = Date.parse(alert.at);
    const seen = Date.parse(alert.seenAt ?? alert.at);
    if (TAPE.has(alert.type)) {
      if (!(Number(alert.amount) >= rules.tapeMinPremium)) return false;
      if (now.getTime() - at > rules.tapeMaxAgeMinutes * 60_000) return false;
    } else {
      if (now.getTime() - seen > rules.seenMaxAgeMinutes * 60_000) return false;
      if (now.getTime() - at > rules.eventMaxAgeDays * 86_400_000) return false;
    }
    // One line per ticker and type per run, so a burst of sweeps in one contract posts once.
    const key = `${alert.ticker}|${alert.type}`;
    if (seenKeys.has(key)) return false;
    // At most two of one type per run, so a broad rally does not fill the channel with movers.
    if ((perType.get(alert.type) ?? 0) >= 2) return false;
    seenKeys.add(key);
    perType.set(alert.type, (perType.get(alert.type) ?? 0) + 1);
    return true;
  });
  return eligible.slice(0, room);
}

export function alertText(alert) {
  return `${formatAlertLine(alert)}\n${SITE}/alerts/?t=${encodeURIComponent(alert.ticker)}`;
}

async function sendTelegram(alert, env, fetcher) {
  const response = await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: alertText(alert), disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`telegram ${response.status}`);
  const body = await response.json().catch(() => ({}));
  return body?.result?.message_id != null ? String(body.result.message_id) : "";
}

async function sendDiscord(alert, env, fetcher) {
  const line = formatAlertLine(alert);
  const response = await fetcher(discordWaitUrl(env.DISCORD_WEBHOOK_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    // flags 4 suppresses the link preview so the feed stays one line per alert.
    body: JSON.stringify({ content: `\`${line}\`\n<${SITE}/alerts/?t=${encodeURIComponent(alert.ticker)}>`, flags: 4, allowed_mentions: { parse: [] } }),
  });
  if (!response.ok) throw new Error(`discord ${response.status}`);
  const body = await response.json().catch(() => ({}));
  return body?.id != null ? String(body.id) : "";
}

export async function postAlerts(options = {}) {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const log = options.log ?? ((line) => console.log(line));
  if (env.SOCIAL_AUTOPOST === "0" || env.SOCIAL_ALERTS === "0") {
    log("alerts social: disabled");
    return [];
  }
  const networks = [
    ...(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? ["telegram"] : []),
    ...(env.DISCORD_WEBHOOK_URL ? ["discord"] : []),
  ];
  if (!networks.length) {
    log("alerts social: no Telegram or Discord secrets");
    return [];
  }
  const feed = JSON.parse(await readFile(path.resolve(options.alertsFile ?? env.ALERTS_FILE), "utf8"));
  const ledgerPath = path.resolve(options.ledger ?? env.SOCIAL_LEDGER);
  let ledger = { posted: {} };
  try {
    ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    ledger.posted ??= {};
  } catch {
    ledger = { posted: {} };
  }
  const now = options.now ? new Date(options.now) : new Date();
  const rules = {
    ...(env.SOCIAL_ALERT_CAP ? { perRun: Number(env.SOCIAL_ALERT_CAP) } : {}),
    ...(env.SOCIAL_ALERT_DAY_CAP ? { perDay: Number(env.SOCIAL_ALERT_DAY_CAP) } : {}),
  };
  const batch = pickAlerts(feed.alerts ?? [], ledger, { now, rules });
  const dry = env.SOCIAL_DRYRUN === "1" || options.dryRun === true;
  const results = [];
  for (const alert of batch) {
    for (const network of networks) {
      if (dry) {
        log(`alerts dry-run ${network}: ${formatAlertLine(alert)}`);
        results.push({ id: alert.id, network, dryRun: true });
        continue;
      }
      try {
        const messageId = network === "telegram" ? await sendTelegram(alert, env, fetcher) : await sendDiscord(alert, env, fetcher);
        const key = ledgerKey(alert);
        ledger.posted[key] = [...new Set([...(ledger.posted[key] ?? []), network])];
        if (messageId) {
          ledger.messages ??= {};
          ledger.messages[key] = { ...(ledger.messages[key] ?? {}), [network]: messageId };
        }
        results.push({ id: alert.id, network, ok: true, messageId });
        log(`alerts posted ${network} ${alert.id}${messageId ? ` message_id ${messageId}` : ""}`);
      } catch (error) {
        results.push({ id: alert.id, network, ok: false });
        log(`alerts failed ${network} ${alert.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  if (!dry && results.some((row) => row.ok)) {
    const day = nyDay(now.getTime());
    const sent = new Set(results.filter((row) => row.ok).map((row) => row.id)).size;
    ledger.alertDays = { ...Object.fromEntries(Object.entries(ledger.alertDays ?? {}).filter(([key]) => key >= nyDay(now.getTime() - 7 * 86_400_000))), [day]: Number(ledger.alertDays?.[day] ?? 0) + sent };
    ledger.updatedAt = now.toISOString();
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  log(`alerts social: ${batch.length} picked, ${results.filter((row) => row.ok).length} sent`);
  return results;
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  await postAlerts();
  process.exit(0);
}
