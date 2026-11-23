import { HomeHero } from "@/components/home/hero";
import { SiteFooter } from "@/components/module-frame";
import { SiteNav } from "@/components/site-nav";
import { loadNews } from "@/lib/news/load";

export default function Page() {
  const all = [...loadNews().stories]
    .filter((story) => story.passedMateriality !== false)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  // Desk-format stories first; older templated notes only fill empty slots.
  const stories = [...all.filter((story) => story.format === "desk"), ...all.filter((story) => story.format !== "desk")];
  // One story per type first so the list is not four rows of the same file.
  const seen = new Set<string>();
  const varied = stories.filter((story) => (seen.has(story.type) ? false : (seen.add(story.type), true)));
  const top = [...varied, ...stories.filter((story) => !varied.includes(story))].slice(0, 4);
  return (
    <div className="min-h-dvh">
      <SiteNav />
      <HomeHero stories={top} />
      <div className="mx-auto max-w-[1440px] px-4 pb-20 md:px-6 md:pb-8">
        <SiteFooter />
      </div>
    </div>
  );
}
