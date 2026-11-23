import type { MetadataRoute } from "next";
import { NAV_HREFS } from "@/lib/nav/model";
import { loadNews, storyHref } from "@/lib/news/load";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const news = loadNews();
  const pages = NAV_HREFS.map((href) => ({
    url: `https://tradehaxai.tech${href}`,
    lastModified: new Date("2026-11-16"),
  }));
  const stories = news.stories.map((story) => ({
    url: `https://tradehaxai.tech${storyHref(story)}`,
    lastModified: new Date(story.publishedAt),
  }));
  const hubs = new Set<string>();
  for (const story of news.stories) {
    hubs.add(`/news/t/${story.ticker}/`);
    hubs.add(`/news/type/${story.type}/`);
    for (const ticker of story.tickers) hubs.add(`/news/t/${ticker}/`);
  }
  return [
    ...pages,
    ...stories,
    ...[...hubs].map((href) => ({ url: `https://tradehaxai.tech${href}`, lastModified: new Date(news.generatedAt) })),
  ];
}
