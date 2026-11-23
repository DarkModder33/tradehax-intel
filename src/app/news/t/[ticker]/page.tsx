import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";
import { NewsList } from "@/components/news/list";
import { DEFAULT_UNIVERSE } from "@/lib/live/universe";
import { loadNews } from "@/lib/news/load";

export const dynamicParams = false;

export function generateStaticParams() {
  // The ticker desk links here for every universe name, so each gets a hub even before
  // its first story. Empty hubs are noindex.
  const names = new Set<string>(DEFAULT_UNIVERSE);
  for (const story of loadNews().stories) {
    names.add(story.ticker);
    for (const ticker of story.tickers) names.add(ticker);
  }
  return [...names].map((ticker) => ({ ticker }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const empty = !loadNews().stories.some((story) => story.ticker === symbol || story.tickers.includes(symbol));
  return {
    title: `${symbol} stock news and data notes`,
    description: `TradeHax notes on ${symbol}: movers, short interest, fails-to-deliver, insider buying and options activity, written from public data.`,
    alternates: { canonical: `https://tradehaxai.tech/news/t/${symbol}/` },
    ...(empty ? { robots: { index: false, follow: true } } : {}),
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
