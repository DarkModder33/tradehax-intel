import { readFileSync } from "node:fs";
import path from "node:path";

export interface KeyNumber {
  label: string;
  value: string;
  source: string;
  asOf: string;
}

export interface Story {
  id: string;
  type: string;
  ticker: string;
  tickers: string[];
  day: string;
  publishedAt: string;
  headline: string;
  dek: string;
  body: string[];
  keyNumbers: KeyNumber[];
  spark: number[];
  sources: { name: string; asOf: string }[];
  materiality: number;
  slug: string;
  passedMateriality: boolean;
  disclaimer: string;
  methodology: string;
}

export interface NewsFile {
  generatedAt: string;
  disclaimer: string;
  stories: Story[];
}

export function loadNews(): NewsFile {
  const file = path.join(process.cwd(), "content", "news", "stories.json");
  const parsed = JSON.parse(readFileSync(file, "utf8")) as NewsFile;
  return { generatedAt: parsed.generatedAt, disclaimer: parsed.disclaimer, stories: parsed.stories ?? [] };
}

export function storyHref(story: Story): string {
  const [year, month] = story.day.split("-");
  return `/news/${year}/${month}/${story.slug}/`;
}

export function findStory(year: string, month: string, slug: string): Story | null {
  return loadNews().stories.find((story) => story.slug === slug && story.day.startsWith(`${year}-${month}`)) ?? null;
}
