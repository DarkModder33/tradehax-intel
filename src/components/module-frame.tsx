import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-white/[0.05] pt-4">
      <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
        Not investment advice. Delayed and inferred data. Dealer gamma uses the naive open-interest sign: calls positive, puts negative.{" "}
        <Link href="/about/" className="hover:text-foreground">About</Link> · <Link href="/about/methodology/" className="hover:text-foreground">Methodology</Link> · <Link href="/status/" className="hover:text-foreground">Status</Link>
      </p>
    </footer>
  );
}

export function ModuleFrame({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <header className="pb-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{lede}</p>
        </header>
        {children}
        <SiteFooter />
      </main>
    </div>
  );
}
