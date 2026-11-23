import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";
import { NewsList } from "@/components/news/list";
import { loadNews } from "@/lib/news/load";

export const metadata: Metadata = {
  title: "News",
  description: "Auto-generated market notes from stored TradeHax files. Not investment advice.",
  alternates: { canonical: "https://tradehaxai.tech/news/" },
};

export default function Page() {
  const news = loadNews();
  const stories = [...news.stories].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return (
    <ModuleFrame title="News" lede="Short notes from the files already on the desk. A story runs only when a stored number clears a fixed threshold.">
      <p className="text-sm text-muted-foreground">
        <Link href="/news/feed.xml" className="underline">RSS</Link>
        {" · "}
        <Link href="/news/atom.xml" className="underline">Atom</Link>
        {" · "}
        <Link href="/about/methodology/" className="underline">Methodology</Link>
      </p>
      <NewsList stories={stories} empty="No story cleared the materiality filter in the latest run. Empty datasets stay empty." />
      <p className="text-xs text-muted-foreground">{news.disclaimer}</p>
    </ModuleFrame>
  );
}
