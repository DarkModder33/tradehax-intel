import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configuredAdapters, oauthHeader, percentEncode, postQueue, selectAdapters, xText } from "../../../scripts/social/post.mjs";

const story = {
  id: "NVDA|mover|2026-11-16",
  type: "mover",
  ticker: "NVDA",
  tickers: ["NVDA"],
  day: "2026-11-16",
  slug: "nvda-mover-2026-11-16",
  headline: "NVDA -12.7% over five sessions",
  dek: "Five-day return from Yahoo daily bars.",
  disclaimer: "Auto-generated from market data — not investment advice.",
  passedMateriality: true,
};

const secrets = {
  SOCIAL_AUTOPOST: "1",
  X_API_KEY: "ck",
  X_API_SECRET: "cs",
  X_ACCESS_TOKEN: "tk",
  X_ACCESS_SECRET: "ts",
  TELEGRAM_BOT_TOKEN: "bot",
  TELEGRAM_CHAT_ID: "1",
  DISCORD_WEBHOOK_URL: "https://discord.test/webhook",
};

function fixture(stories = [story]) {
  const dir = mkdtempSync(path.join(tmpdir(), "social-"));
  const news = path.join(dir, "stories.json");
  const ledger = path.join(dir, "social-posted.json");
  writeFileSync(news, JSON.stringify({ stories }));
  return { news, ledger, dir };
}

describe("social posting", () => {
  it("signs X requests with OAuth 1.0a and keeps the post under 270 characters", () => {
    expect(percentEncode("a b!*")).toBe("a%20b%21%2A");
    expect(oauthHeader({
      method: "POST",
      url: "https://api.x.com/2/tweets",
      consumerKey: "ck",
      consumerSecret: "cs",
      token: "tk",
      tokenSecret: "ts",
      nonce: "n",
      timestamp: 1700000000,
    })).toContain("oauth_signature=\"0QyCXARxSTVTPgUai4xuBUVPHQM%3D\"");
    const text = xText(story);
    expect(text.length).toBeLessThanOrEqual(270);
    expect(text).toContain("$NVDA");
    expect(text).toContain("https://tradehaxai.tech/news/2026/11/nvda-mover-2026-11-16/");
    expect(configuredAdapters({})).toEqual([]);
    expect(configuredAdapters(secrets)).toEqual(["x", "telegram", "discord"]);
    expect(selectAdapters({ ...secrets, SOCIAL_PLATFORMS: "discord,telegram" })).toEqual(["telegram", "discord"]);
  });

  it("dry-run logs and does not post or record ids", async () => {
    const { news, ledger } = fixture();
    const logs: string[] = [];
    const result = await postQueue({
      env: { ...secrets, SOCIAL_DRYRUN: "1" },
      newsFile: news,
      ledger,
      sleep: async () => {},
      log: (line: string) => logs.push(line),
      fetcher: async () => {
        throw new Error("network");
      },
    });
    expect(result.ok).toBe(true);
    expect(logs.some((line) => line.includes("dry-run x"))).toBe(true);
    expect(logs.some((line) => line.includes("bluesky stubbed"))).toBe(true);
    expect(() => readFileSync(ledger, "utf8")).toThrow();
  });

  it("posts only material stories, backs off on 429, and skips a second run", async () => {
    const quiet = { ...story, id: "KO|mover|2026-11-16", ticker: "KO", passedMateriality: false };
    const extra = { ...story, id: "AMD|mover|2026-11-16", ticker: "AMD", slug: "amd-mover-2026-11-16", headline: "AMD +18.9% over five sessions" };
    const { news, ledger } = fixture([quiet, story, extra]);
    const calls: { url: string; body: string }[] = [];
    let xHits = 0;
    const fetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, body: String(init?.body ?? "") });
      if (href.includes("api.x.com")) {
        xHits += 1;
        if (xHits === 1) return new Response("rate", { status: 429, headers: { "retry-after": "1" } });
      }
      if (href.includes("api.telegram.org")) return new Response("no", { status: 500 });
      return new Response("{}", { status: 200 });
    };
    const waits: number[] = [];
    const first = await postQueue({
      env: secrets,
      newsFile: news,
      ledger,
      cap: 1,
      sleep: async (ms: number) => {
        waits.push(ms);
      },
      log: () => {},
      fetcher: fetcher as typeof fetch,
    });
    expect(first.ok).toBe(true);
    expect(first.results.filter((row) => row.id === quiet.id)).toHaveLength(0);
    expect(new Set(first.results.map((row) => row.id))).toEqual(new Set([story.id]));
    expect(calls.some((call) => call.url === "https://discord.test/webhook" && call.body.includes("/news/og/nvda-mover-2026-11-16.png"))).toBe(true);
    expect(calls.some((call) => call.url.includes("api.telegram.org/botbot/sendMessage"))).toBe(true);
    expect(waits).toContain(1000);
    const saved = JSON.parse(readFileSync(ledger, "utf8"));
    expect(saved.posted[story.id].sort()).toEqual(["discord", "x"]);
    const secondCalls = calls.length;
    await postQueue({ env: secrets, newsFile: news, ledger, cap: 8, sleep: async () => {}, log: () => {}, fetcher: fetcher as typeof fetch });
    const later = calls.slice(secondCalls);
    const xBodies = later.filter((call) => call.url.includes("api.x.com")).map((call) => call.body);
    expect(xBodies.some((body) => body.includes("NVDA"))).toBe(false);
    expect(xBodies.some((body) => body.includes("AMD"))).toBe(true);
  });

  it("stays quiet when posting is turned off", async () => {
    const { news, ledger } = fixture();
    const result = await postQueue({
      env: { SOCIAL_AUTOPOST: "0" },
      newsFile: news,
      ledger,
      fetcher: async () => {
        throw new Error("network");
      },
      log: () => {},
    });
    expect(result.results).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
