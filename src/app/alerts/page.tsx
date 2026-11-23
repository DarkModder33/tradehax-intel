import type { Metadata } from "next";
import Link from "next/link";
import { AlertsFeed } from "@/components/alerts/feed";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Market alerts: sweeps, flow spikes, gamma flips, insider and Congress trades",
  description: "A one-line alert feed: options sweeps and blocks, volume spikes, dealer gamma flips, insider buying clusters, short-interest jumps, Congress trades, earnings moves versus implied, and big movers.",
};

export default function Page() {
  return (
    <ModuleFrame
      title="Alerts"
      lede="One line per event, from the options tape and the latest filings. For context and analysis, read the news."
    >
      <AlertsFeed />
      <p className="mt-4 text-xs text-muted-foreground">
        Browser alert rules for your own watchlist are on the <Link href="/alerts/rules/" className="underline hover:text-foreground">rules page</Link>.
      </p>
    </ModuleFrame>
  );
}
