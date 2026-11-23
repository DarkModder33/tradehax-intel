import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleFrame } from "@/components/module-frame";
import { AdSlot, AffiliateBlock } from "@/components/monetization/slots";
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

function byline(story: Story) {
  const date = new Date(story.publishedAt);
  return Number.isNaN(date.getTime())
    ? story.day
    : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date) + " ET";
}

function DeskArticle({ story }: { story: Story }) {
  return (
    <article className="grid max-w-3xl gap-5">
      <p className="text-[15px] leading-relaxed text-foreground/95">{story.lede}</p>
      {(story.sections ?? []).map((section) => (
        <section key={section.heading}>
          <h2 className="mb-1.5 text-[13px] font-semibold">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="text-[14px] leading-relaxed text-foreground/85">{paragraph}</p>
          ))}
        </section>
      ))}
      {story.table ? (
        <section className="surface overflow-x-auto">
          <table className="w-full text-[13px]">
            <caption className="px-4 pt-3 text-left text-[12px] font-medium text-muted-foreground">{story.table.caption}</caption>
            <thead>
              <tr>
                {story.table.columns.map((column, index) => (
                  <th key={column} className={index === 0 ? "px-4 py-2 text-left" : "px-4 py-2 text-right"}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {story.table.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, index) => (
                    <td key={`${index}-${cell}`} className={index === 0 ? "px-4 py-1.5" : "px-4 py-1.5 text-right font-mono"}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {story.watch?.length ? (
        <section>
          <h2 className="mb-1.5 text-[13px] font-semibold">What to watch</h2>
          <ul className="grid gap-1.5 pl-4 text-[14px] leading-relaxed text-foreground/85 [list-style:disc]">
            {story.watch.map((item) => <li key={item.slice(0, 48)}>{item}</li>)}
          </ul>
        </section>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Sources: {story.sources.map((source) => source.name).join("; ")}. {story.disclaimer} <Link href={story.methodology} className="hover:text-foreground">Methodology</Link>
      </p>
    </article>
  );
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
      <p className="text-xs text-muted-foreground">
        <Link href="/news/" className="hover:text-foreground">News</Link>
        {" · "}
        <Link href={`/news/type/${story.type}/`} className="hover:text-foreground">{story.type}</Link>
        {" · "}
        {story.ticker !== "SECTORS" ? <><Link href={`/t/?s=${story.ticker}`} className="hover:text-foreground">{story.ticker} desk</Link>{" · "}<Link href={`/alerts/?t=${story.ticker}`} className="hover:text-foreground">{story.ticker} alerts</Link>{" · "}</> : null}
        <span>{byline(story)}</span>
      </p>
      {story.format === "desk" ? (
        <>
          <StorySpark values={story.spark} label={`${story.ticker} recent closes`} />
          <DeskArticle story={story} />
        </>
      ) : (
        <>
          <table className="w-full max-w-3xl text-sm">
            <caption className="sr-only">Key numbers</caption>
            <thead>
              <tr>
                <th className="py-1 pr-3 text-left">Figure</th>
                <th className="py-1 pr-3 text-left">Value</th>
                <th className="py-1 pr-3 text-left">Source</th>
                <th className="py-1 text-left">As of</th>
              </tr>
            </thead>
            <tbody>
              {story.keyNumbers.map((item) => (
                <tr key={item.label}>
                  <td className="py-1 pr-3">{item.label}</td>
                  <td className="py-1 pr-3 font-mono">{item.value}</td>
                  <td className="py-1 pr-3">{item.source}</td>
                  <td className="py-1">{item.asOf}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
            {story.body.map((paragraph) => <p key={paragraph.slice(0, 48)}>{paragraph}</p>)}
          </div>
          <p className="text-xs text-muted-foreground">{story.disclaimer} <Link href={story.methodology} className="hover:text-foreground">Methodology</Link></p>
        </>
      )}
      <AffiliateBlock />
      <AdSlot />
    </ModuleFrame>
  );
}
