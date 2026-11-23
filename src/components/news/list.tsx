import Link from "next/link";
import { newsTypeLabel } from "@/lib/news/labels";
import { storyHref, type Story } from "@/lib/news/load";

export function NewsList({ stories, empty }: { stories: Story[]; empty: string }) {
  if (!stories.length) return <div className="surface px-4 py-8 text-center text-sm text-muted-foreground">{empty}</div>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {stories.map((story) => (
        <li key={story.id} className="surface group relative px-4 py-4 transition-colors hover:border-gold/40">
          <p className="flex items-center gap-2 text-[10.5px] tracking-[0.14em] uppercase">
            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-gold">{newsTypeLabel(story.type)}</span>
            <span className="text-muted-foreground">{story.day}</span>
            {story.ticker ? <span className="font-mono text-foreground/70">{story.ticker}</span> : null}
          </p>
          <h2 className="mt-2 text-[17px] leading-snug font-semibold tracking-tight group-hover:text-gold">
            <Link href={storyHref(story)} className="after:absolute after:inset-0">{story.headline}</Link>
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{story.dek}</p>
        </li>
      ))}
    </ul>
  );
}
