import { Dashboard } from "@/components/dashboard";
import { HomeHero } from "@/components/home/hero";
import { loadNews } from "@/lib/news/load";

export default function Page() {
  const stories = [...loadNews().stories]
    .filter((story) => story.passedMateriality !== false)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  // One story per type first so the strip is not four rows of the same file.
  const seen = new Set<string>();
  const varied = stories.filter((story) => (seen.has(story.type) ? false : (seen.add(story.type), true)));
  const top = [...varied, ...stories.filter((story) => !varied.includes(story))].slice(0, 4);
  return <Dashboard intro={<HomeHero stories={top} />} />;
}
