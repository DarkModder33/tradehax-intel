import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";
import { NewsList } from "@/components/news/list";
import { loadNews } from "@/lib/news/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(loadNews().stories.map((story) => story.type))].map((type) => ({ type }));
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  return {
    title: `${type} notes`,
    description: `TradeHax ${type} stories that cleared the materiality filter.`,
    alternates: { canonical: `https://tradehaxai.tech/news/type/${type}/` },
  };
}

export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const stories = loadNews().stories.filter((story) => story.type === type);
  return (
    <ModuleFrame title={`${type} notes`} lede="One desk type. The threshold for this type is described in the story itself.">
      <p className="text-sm"><Link href="/news/" className="underline">All news</Link></p>
      <NewsList stories={stories} empty="Nothing of this type cleared the filter." />
    </ModuleFrame>
  );
}
