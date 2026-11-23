import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildStories, mergeStories } from "./engine.mjs";

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

const root = process.cwd();
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "public", "data");
const outFile = path.resolve(process.env.NEWS_OUT ?? path.join(root, "content", "news", "stories.json"));
const priorFile = process.env.NEWS_PRIOR ? path.resolve(process.env.NEWS_PRIOR) : outFile;

const input = {
  technicals: await readJson(path.join(dataDir, "technicals.json")),
  shorts: await readJson(path.join(dataDir, "shorts.json")),
  ftd: await readJson(path.join(dataDir, "ftd.json")),
  insiders: await readJson(path.join(dataDir, "insiders.json")),
  oiChange: await readJson(path.join(dataDir, "oi-change.json")),
  earnings: await readJson(path.join(dataDir, "earnings-moves.json")),
  iv: await readJson(path.join(dataDir, "iv.json")),
  ivHistory: await readJson(path.join(dataDir, "iv-history.json")),
  macro: await readJson(path.join(dataDir, "macro.json")),
  macroPrevious: await readJson(process.env.PREV_DIR ? path.join(process.env.PREV_DIR, "macro.json") : ""),
};

const fresh = buildStories(input, { cap: Number(process.env.NEWS_CAP ?? 10) });
const previous = await readJson(priorFile);
// Stories that shipped in the repo seed file were already posted to social, so keep their
// URLs alive (mergeStories still ages them out after its keep window).
const seedFile = path.join(root, "content", "news", "stories.json");
const seed = path.resolve(seedFile) === outFile ? null : await readJson(seedFile);
// Retracted ids never come back, whichever file they were merged from.
const retracted = new Set(Object.keys((await readJson(path.join(root, "content", "news", "retracted.json")))?.retracted ?? {}));
const stories = mergeStories([...(seed?.stories ?? []), ...(previous?.stories ?? [])], fresh).filter((story) => !retracted.has(story.id));
if (retracted.size) console.log(`news: ${retracted.size} retracted id(s) filtered`);
const payload = {
  generatedAt: new Date().toISOString(),
  disclaimer: fresh[0]?.disclaimer ?? "Auto-generated from market data — not investment advice.",
  stories,
};
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`);
if (process.env.DATA_DIR) {
  const mirror = path.join(dataDir, "news", "stories.json");
  await mkdir(path.dirname(mirror), { recursive: true });
  await writeFile(mirror, `${JSON.stringify(payload, null, 2)}\n`);
}
console.log(`news: ${fresh.length} new, ${stories.length} stored, ${outFile}`);
