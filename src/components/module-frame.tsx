import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export function ModuleFrame({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 md:px-6">
        <header>
          <p className="text-[11px] tracking-[0.18em] text-gold uppercase">TradeHax</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{lede}</p>
        </header>
        {children}
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Not investment advice. Delayed and inferred data. Dealer gamma uses the naive open-interest sign: calls positive, puts negative.{" "}
          <Link href="/about/" className="underline">About</Link> · <Link href="/status/" className="underline">Status</Link>
        </p>
      </main>
    </div>
  );
}
