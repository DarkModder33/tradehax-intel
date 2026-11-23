import Link from "next/link";
import { AlertsStrip } from "@/components/alerts/feed";
import { GammaModule, NetPremiumModule } from "@/components/home/modules";
import { MarketStrip } from "@/components/home/market-strip";
import { newsTypeLabel } from "@/lib/news/labels";
import { storyHref, type Story } from "@/lib/news/load";

function stamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) + " ET";
}

export function HomeHero({ stories }: { stories: Story[] }) {
  const top = stories.slice(0, 4);
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-6 md:px-6 md:pt-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="max-w-3xl text-[22px] leading-tight font-semibold tracking-tight md:text-[28px]">
            Options flow, dealer gamma and insider filings, as they print.
          </h1>
          <p className="text-xs text-muted-foreground">Free. Delayed about 15 minutes.</p>
        </div>
        <MarketStrip />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <AlertsStrip limit={14} title="Alerts" />
        <section aria-labelledby="top-stories">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="top-stories" className="section-title">Top stories</h2>
            <Link href="/news/" className="text-xs text-muted-foreground hover:text-foreground">News →</Link>
          </div>
          {top.length === 0 ? (
            <div className="surface px-4 py-3 text-xs text-muted-foreground">No story cleared the bar in the latest run.</div>
          ) : (
            <ul className="surface divide-y divide-white/[0.04]">
              {top.map((story) => (
                <li key={story.id}>
                  <Link href={storyHref(story)} className="group block px-4 py-3">
                    <span className="text-[11px] text-muted-foreground">{newsTypeLabel(story.type)} · {stamp(story.publishedAt)}</span>
                    <span className="mt-0.5 block text-sm leading-snug font-medium group-hover:text-gold">{story.headline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <NetPremiumModule />
        <GammaModule />
      </div>
    </main>
  );
}
