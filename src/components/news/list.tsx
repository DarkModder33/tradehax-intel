import Link from "next/link";
import { newsTypeLabel } from "@/lib/news/labels";
import { storyHref, type Story } from "@/lib/news/load";

function stamp(story: Story) {
  const date = new Date(story.publishedAt);
  if (Number.isNaN(date.getTime())) return story.day;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) + " ET";
}

export function NewsList({ stories, empty, compact = false }: { stories: Story[]; empty: string; compact?: boolean }) {
  if (!stories.length) return <div className="surface px-4 py-6 text-sm text-muted-foreground">{empty}</div>;
  return (
    <ul className="surface divide-y divide-white/[0.05]">
      {stories.map((story) => (
        <li key={story.id} className="group relative px-4 py-3.5">
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span className="text-gold/90">{newsTypeLabel(story.type)}</span>
            {story.ticker && story.ticker !== "SECTORS" ? <span className="font-mono text-foreground/70">{story.ticker}</span> : null}
            <span>{stamp(story)}</span>
          </p>
          <h2 className={compact ? "mt-1 text-sm leading-snug font-medium group-hover:text-gold" : "mt-1 text-[16px] leading-snug font-semibold tracking-tight group-hover:text-gold"}>
            <Link href={storyHref(story)} className="after:absolute after:inset-0">{story.headline}</Link>
          </h2>
          {compact ? null : <p className="mt-1 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{story.lede ?? story.dek}</p>}
        </li>
      ))}
    </ul>
  );
}
