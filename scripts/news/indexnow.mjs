import { readFile } from "node:fs/promises";
import path from "node:path";
import { storyPath } from "./engine.mjs";
import { freshStories } from "./feeds.mjs";

const KEY = "a7c3e91b4d2f48e0a1b6c5d4e3f2a190";
const HOST = "tradehaxai.tech";

if (process.env.INDEXNOW !== "1") {
  console.log("indexnow: off (set INDEXNOW=1 to ping)");
  process.exit(0);
}

try {
  const source = path.resolve(process.env.NEWS_FILE ?? path.join(process.cwd(), "content", "news", "stories.json"));
  const payload = JSON.parse(await readFile(source, "utf8"));
  const urls = freshStories(payload.stories ?? []).map((story) => `https://${HOST}${storyPath(story)}`);
  if (!urls.length) {
    console.log("indexnow: no stories in the last 48 hours");
    process.exit(0);
  }
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(0, 100) }),
  });
  console.log(`indexnow: ${response.status} for ${urls.length} urls`);
} catch (error) {
  console.error(`indexnow: ${error instanceof Error ? error.message : error}`);
}
process.exit(0);
