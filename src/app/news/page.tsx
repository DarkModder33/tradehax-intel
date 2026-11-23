import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";
import { AdSlot, Newsletter } from "@/components/monetization/slots";
import { NewsList } from "@/components/news/list";
import { loadNews } from "@/lib/news/load";

export const metadata: Metadata = {
  title: "Market news",
  description: "Market stories from TradeHax Intel: the move, why it matters, the levels and what to watch. Not investment advice.",
  alternates: { canonical: "https://tradehaxai.tech/news/" },
};

export default function Page() {
  const news = loadNews();
  const stories = [...news.stories].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  const desk = stories.filter((story) => story.format === "desk");
  const earlier = stories.filter((story) => story.format !== "desk");
  return (
    <ModuleFrame title="News" lede="Stories written when a move has substance: what happened, why it matters, the levels and what to watch. Quick one-line signals live in Alerts.">
      <p className="text-xs text-muted-foreground">
        <Link href="/alerts/" className="hover:text-foreground">Alerts</Link>
        {" · "}
        <a href="/news/feed.xml" className="hover:text-foreground">RSS</a>
        {" · "}
        <a href="/news/atom.xml" className="hover:text-foreground">Atom</a>
        {" · "}
        <Link href="/about/methodology/" className="hover:text-foreground">Methodology</Link>
      </p>
      <NewsList stories={desk.length ? desk : stories} empty="No story cleared the bar in the latest run. Alerts carry the smaller moves." />
      {desk.length && earlier.length ? (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Earlier desk notes ({earlier.length})</summary>
          <div className="mt-3">
            <NewsList stories={earlier} empty="" compact />
          </div>
        </details>
      ) : null}
      <Newsletter />
      <AdSlot />
      <p className="text-xs text-muted-foreground">{news.disclaimer}</p>
    </ModuleFrame>
  );
}
