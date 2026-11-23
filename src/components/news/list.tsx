import Link from "next/link";
import { newsTypeLabel } from "@/lib/news/labels";
import { storyHref, type Story } from "@/lib/news/load";

export function NewsList({ stories, empty }: { stories: Story[]; empty: string }) {
  if (!stories.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {stories.map((story) => (
        <li key={story.id} className="rounded-xl bg-card/70 px-3 py-3 ring-1 ring-foreground/10">
          <p className="text-[11px] tracking-[0.14em] text-gold uppercase">{newsTypeLabel(story.type)} · {story.day}</p>
          <h2 className="text-lg font-semibold tracking-tight">
            <Link href={storyHref(story)} className="underline-offset-4 hover:underline">{story.headline}</Link>
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{story.dek}</p>
        </li>
      ))}
    </ul>
  );
}
