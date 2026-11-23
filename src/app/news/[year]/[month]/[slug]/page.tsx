import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleFrame } from "@/components/module-frame";
import { StorySpark } from "@/components/news/spark";
import { findStory, loadNews, storyHref, type Story } from "@/lib/news/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadNews().stories.map((story) => {
    const [year, month] = story.day.split("-");
    return { year, month, slug: story.slug };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ year: string; month: string; slug: string }> }): Promise<Metadata> {
  const { year, month, slug } = await params;
  const story = findStory(year, month, slug);
  if (!story) return { title: "Missing story" };
  const url = `https://tradehaxai.tech${storyHref(story)}`;
  const image = `/news/og/${story.slug}.png`;
  return {
    title: story.headline,
    description: story.dek,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: story.headline,
      description: story.dek,
      url,
      publishedTime: story.publishedAt,
      images: [{ url: image, width: 1200, height: 630, alt: story.headline }],
    },
    twitter: { card: "summary_large_image", title: story.headline, description: story.dek, images: [image] },
  };
}

function jsonLd(story: Story) {
  const url = `https://tradehaxai.tech${storyHref(story)}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: story.headline,
      description: story.dek,
      datePublished: story.publishedAt,
      dateModified: story.publishedAt,
      mainEntityOfPage: url,
      image: [`https://tradehaxai.tech/news/og/${story.slug}.png`],
      author: { "@type": "Organization", name: "TradeHax Intel" },
      publisher: { "@type": "Organization", name: "TradeHax Intel", url: "https://tradehaxai.tech" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "News", item: "https://tradehaxai.tech/news/" },
        { "@type": "ListItem", position: 2, name: story.ticker, item: `https://tradehaxai.tech/news/t/${story.ticker}/` },
        { "@type": "ListItem", position: 3, name: story.headline, item: url },
      ],
    },
  ];
}

export default async function Page({ params }: { params: Promise<{ year: string; month: string; slug: string }> }) {
  const { year, month, slug } = await params;
  const story = findStory(year, month, slug);
  if (!story) notFound();
  return (
    <ModuleFrame title={story.headline} lede={story.dek}>
      {jsonLd(story).map((block) => (
        <script key={block["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}
      <p className="text-sm text-muted-foreground">
        <Link href="/news/" className="underline">News</Link>
        {" · "}
        <Link href={`/news/t/${story.ticker}/`} className="underline">{story.ticker}</Link>
        {" · "}
        <Link href={`/news/type/${story.type}/`} className="underline">{story.type}</Link>
        {" · "}
        <Link href={`/t/?s=${story.ticker}`} className="underline">Ticker desk</Link>
      </p>
      <table className="w-full max-w-3xl text-sm">
        <caption className="sr-only">Key numbers</caption>
        <thead>
          <tr className="text-left text-[11px] tracking-[0.14em] text-gold uppercase">
            <th className="py-1 pr-3">Figure</th>
            <th className="py-1 pr-3">Value</th>
            <th className="py-1 pr-3">Source</th>
            <th className="py-1">As of</th>
          </tr>
        </thead>
        <tbody>
          {story.keyNumbers.map((item) => (
            <tr key={item.label} className="border-t border-foreground/10">
              <td className="py-1 pr-3">{item.label}</td>
              <td className="py-1 pr-3 font-mono">{item.value}</td>
              <td className="py-1 pr-3">{item.source}</td>
              <td className="py-1">{item.asOf}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <StorySpark values={story.spark} label={`${story.ticker} stored points`} />
      <p className="text-xs text-muted-foreground">Stored points used in this note. Not an intraday chart.</p>
      <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
        {story.body.map((paragraph) => <p key={paragraph.slice(0, 48)}>{paragraph}</p>)}
      </div>
      <p className="text-sm">{story.disclaimer} <Link href={story.methodology} className="underline">Methodology</Link></p>
    </ModuleFrame>
  );
}
