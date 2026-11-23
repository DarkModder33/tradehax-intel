import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketStrip } from "@/components/home/market-strip";
import { newsTypeLabel } from "@/lib/news/labels";
import { storyHref, type Story } from "@/lib/news/load";

const FEATURES = [
  { href: "/flow/", title: "Options flow", body: "Sweeps, blocks, and unusual prints, scored and filtered." },
  { href: "/gex/", title: "Dealer gamma", body: "Gamma by strike and expiry, walls, and the flip level." },
  { href: "/tide/", title: "Market tide", body: "Intraday call vs put premium, net and by sector." },
  { href: "/congress/", title: "Congress trades", body: "Parsed House disclosures by member, ticker, and size." },
  { href: "/offex/", title: "Dark pool", body: "FINRA off-exchange volume and short sale ratios." },
  { href: "/earnings/", title: "Earnings moves", body: "Implied move vs what the stock actually did." },
];

function ago(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) + " ET";
}

export function HomeHero({ stories }: { stories: Story[] }) {
  const top = stories.slice(0, 4);
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pt-6 md:px-6 md:pt-10">
      <section className="hero-glow relative overflow-hidden rounded-3xl border border-white/[0.08] px-5 py-7 md:px-10 md:py-12">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-medium tracking-wide text-gold">
              <span className="size-1.5 animate-pulse rounded-full bg-gold" />
              Free. No account. No paywall.
            </p>
            <h1 className="mt-4 max-w-2xl text-[1.75rem] leading-[1.1] font-semibold tracking-tight text-balance md:text-5xl">
              Options flow, dealer gamma, and the market wire, in one free desk.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-base">
              TradeHax Intel tracks unusual options activity, gamma exposure, dark pool volume, insider and Congress filings, and writes a news story when a number actually moves.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/flow/" className="inline-flex h-10 items-center gap-2 rounded-full bg-gold px-5 text-sm font-semibold text-[#1a1406] shadow-[0_8px_30px_-8px] shadow-gold/60 transition hover:brightness-110">
                Open live flow <ArrowRight className="size-4" />
              </Link>
              <Link href="/gex/" className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.04] px-5 text-sm font-medium transition hover:border-white/30">
                Gamma map
              </Link>
              <Link href="/news/" className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.04] px-5 text-sm font-medium transition hover:border-white/30">
                Read the wire
              </Link>
            </div>
          </div>
          <ul className="hidden grid-cols-2 gap-2 sm:grid">
            {FEATURES.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="surface block h-full px-3.5 py-3 transition-colors hover:border-gold/40">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MarketStrip />

      <section aria-labelledby="top-stories">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The wire</p>
            <h2 id="top-stories" className="text-xl font-semibold tracking-tight">Top stories</h2>
          </div>
          <Link href="/news/" className="text-sm text-gold hover:underline">All stories</Link>
        </div>
        {top.length === 0 ? (
          <div className="surface px-4 py-6 text-sm text-muted-foreground">No story cleared the materiality filter in the latest run.</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {top.map((story) => (
              <li key={story.id}>
                <Link href={storyHref(story)} className="surface group flex h-full flex-col px-4 py-3.5 transition-colors hover:border-gold/40">
                  <span className="text-[10px] tracking-[0.16em] text-gold uppercase">{newsTypeLabel(story.type)}</span>
                  <span className="mt-1.5 text-[15px] leading-snug font-semibold group-hover:text-gold">{story.headline}</span>
                  <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{story.dek}</span>
                  <span className="mt-auto pt-3 text-[11px] text-muted-foreground">{ago(story.publishedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
