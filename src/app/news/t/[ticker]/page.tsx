import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";
import { NewsList } from "@/components/news/list";
import { loadNews } from "@/lib/news/load";

export const dynamicParams = false;

export function generateStaticParams() {
  const names = new Set<string>();
  for (const story of loadNews().stories) {
    names.add(story.ticker);
    for (const ticker of story.tickers) names.add(ticker);
  }
  return [...names].map((ticker) => ({ ticker }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  return {
    title: `${symbol} news`,
    description: `TradeHax notes that mention ${symbol}.`,
    alternates: { canonical: `https://tradehaxai.tech/news/t/${symbol}/` },
  };
}

export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const stories = loadNews().stories.filter((story) => story.ticker === symbol || story.tickers.includes(symbol));
  return (
    <ModuleFrame title={`${symbol} news`} lede={`Stories that cite ${symbol}. Each one links back to the ticker desk.`}>
      <p className="text-sm"><Link href={`/t/?s=${symbol}`} className="underline">Open {symbol} on the ticker desk</Link></p>
      <NewsList stories={stories} empty={`No stored story mentions ${symbol} yet.`} />
    </ModuleFrame>
  );
}
