import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export function ModuleFrame({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        <header className="border-b border-white/[0.06] pb-5">
          <p className="eyebrow">TradeHax Intel</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">{lede}</p>
        </header>
        {children}
        <footer className="mt-6 border-t border-white/[0.06] pt-4">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Not investment advice. Delayed and inferred data. Dealer gamma uses the naive open-interest sign: calls positive, puts negative.{" "}
            <Link href="/about/" className="underline underline-offset-2">About</Link> · <Link href="/about/methodology/" className="underline underline-offset-2">Methodology</Link> · <Link href="/status/" className="underline underline-offset-2">Status</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
