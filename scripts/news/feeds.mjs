import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { storyPath } from "./engine.mjs";

const SITE = "https://tradehaxai.tech";
const WINDOW_MS = 48 * 60 * 60 * 1000;

export function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function freshStories(stories, now = Date.now()) {
  return stories.filter((story) => {
    const at = Date.parse(story.publishedAt);
    return Number.isFinite(at) && now >= at && now - at <= WINDOW_MS;
  });
}

function rss(stories) {
  const items = stories.map((story) => `    <item>
      <title>${xmlEscape(story.headline)}</title>
      <link>${SITE}${storyPath(story)}</link>
      <guid>${SITE}${storyPath(story)}</guid>
      <pubDate>${new Date(story.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(story.dek)}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>TradeHax Intel news</title>
    <link>${SITE}/news/</link>
    <description>Auto-generated market notes from stored files. Not investment advice.</description>
${items}
  </channel>
</rss>
`;
}

function atom(stories) {
  const items = stories.map((story) => `  <entry>
    <title>${xmlEscape(story.headline)}</title>
    <link href="${SITE}${storyPath(story)}"/>
    <id>${SITE}${storyPath(story)}</id>
    <updated>${new Date(story.publishedAt).toISOString()}</updated>
    <summary>${xmlEscape(story.dek)}</summary>
  </entry>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>TradeHax Intel news</title>
  <link href="${SITE}/news/"/>
  <updated>${new Date().toISOString()}</updated>
  <id>${SITE}/news/atom.xml</id>
${items}
</feed>
`;
}

function newsSitemap(stories, now) {
  const urls = freshStories(stories, now).map((story) => `  <url>
    <loc>${SITE}${storyPath(story)}</loc>
    <news:news>
      <news:publication>
        <news:name>TradeHax Intel</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(story.publishedAt).toISOString()}</news:publication_date>
      <news:title>${xmlEscape(story.headline)}</news:title>
    </news:news>
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const source = path.resolve(process.env.NEWS_FILE ?? path.join(root, "content", "news", "stories.json"));
  const payload = JSON.parse(await readFile(source, "utf8"));
  const stories = payload.stories ?? [];
  const now = process.env.NEWS_NOW ? Date.parse(process.env.NEWS_NOW) : Date.now();
  await mkdir(path.join(root, "public", "news"), { recursive: true });
  await writeFile(path.join(root, "public", "news", "feed.xml"), rss(stories));
  await writeFile(path.join(root, "public", "news", "atom.xml"), atom(stories));
  await writeFile(path.join(root, "public", "news-sitemap.xml"), newsSitemap(stories, now));
  console.log(`feeds: ${stories.length} in RSS, ${freshStories(stories, now).length} in the 48h news sitemap`);
}
