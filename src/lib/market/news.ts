import { CORS_PROXY } from "@/lib/sources/proxy";
import { workerConnected, workerUrl } from "@/lib/live/worker";

export interface NewsItem {
  title: string;
  publisher: string;
  url: string | null;
}

export function yahooNewsUpstream(query: string, count = 8): string {
  const params = new URLSearchParams({
    q: query,
    newsCount: String(Math.min(Math.max(count, 1), 20)),
    quotesCount: "0",
  });
  return `https://query1.finance.yahoo.com/v1/finance/search?${params}`;
}

export function yahooNewsProxyUrl(query: string, count = 8): string {
  return `${CORS_PROXY}${yahooNewsUpstream(query, count)}`;
}

export function parseNews(payload: unknown, limit = 8): NewsItem[] {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(body.news) ? body.news : [];
  const items: NewsItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) continue;
    items.push({
      title,
      publisher: typeof raw.publisher === "string" && raw.publisher ? raw.publisher : "Yahoo Finance",
      url: typeof raw.link === "string" ? raw.link : typeof raw.url === "string" ? raw.url : null,
    });
    if (items.length >= limit) break;
  }
  return items;
}

/** Worker first, then the keyless proxy. Returns an empty list when both fail. */
export async function fetchNews(query: string, count = 3, fetcher: typeof fetch = fetch): Promise<{ items: NewsItem[]; source: string }> {
  const attempts: string[] = [];
  if (workerConnected()) attempts.push(`${workerUrl()}/v1/news?q=${encodeURIComponent(query)}&newsCount=${count}`);
  attempts.push(yahooNewsProxyUrl(query, count));
  let last = "no headline source answered";
  for (const url of attempts) {
    try {
      const response = await fetcher(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) {
        last = `${new URL(url).host} returned ${response.status}`;
        continue;
      }
      const items = parseNews(await response.json(), count);
      if (!items.length && url !== attempts[attempts.length - 1]) continue;
      const source = url.includes("/v1/news") ? "Yahoo Finance via worker" : "Yahoo Finance via proxy";
      return { items, source };
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}
