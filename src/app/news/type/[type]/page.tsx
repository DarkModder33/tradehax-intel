import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";
import { NewsList } from "@/components/news/list";
import { NEWS_TYPE_LABELS, newsTypeLabel } from "@/lib/news/labels";
import { loadNews } from "@/lib/news/load";

export const dynamicParams = false;

export function generateStaticParams() {
  // Every known type gets a hub, so a link to a quiet type never 404s.
  const types = new Set([...Object.keys(NEWS_TYPE_LABELS), ...loadNews().stories.map((story) => story.type)]);
  return [...types].map((type) => ({ type }));
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  const label = newsTypeLabel(type);
  const empty = !loadNews().stories.some((story) => story.type === type);
  return {
    title: `${label} news`,
    description: `TradeHax ${label.toLowerCase()} stories, written from public market data when a number clears a fixed threshold.`,
    alternates: { canonical: `https://tradehaxai.tech/news/type/${type}/` },
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const stories = loadNews().stories.filter((story) => story.type === type);
  return (
    <ModuleFrame title={`${newsTypeLabel(type)} news`} lede="One desk type. The threshold for this type is described in the story itself.">
      <p className="text-sm"><Link href="/news/" className="underline">All news</Link></p>
      <NewsList stories={stories} empty="Nothing of this type cleared the filter." />
    </ModuleFrame>
  );
}
