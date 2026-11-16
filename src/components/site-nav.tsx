"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TickerSearch } from "@/components/ticker-search";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Desk" },
  { href: "/chart/", label: "Chart" },
  { href: "/t/", label: "Ticker" },
  { href: "/alerts/", label: "Alerts" },
  { href: "/flow/history/", label: "History" },
  { href: "/map/", label: "Map" },
  { href: "/markets/", label: "Markets" },
  { href: "/workspace/", label: "Workspace" },
  { href: "/gex/", label: "Gamma" },
  { href: "/chain/", label: "Chain" },
  { href: "/vol/", label: "Vol" },
  { href: "/flow/", label: "Flow" },
  { href: "/flow/hot/", label: "Hot" },
  { href: "/tide/", label: "Tide" },
  { href: "/offex/", label: "Off-ex" },
  { href: "/shorts/", label: "Shorts" },
  { href: "/strategy/", label: "Strategy" },
  { href: "/insiders/", label: "Insiders" },
  { href: "/congress/", label: "Congress" },
  { href: "/institutions/", label: "13F" },
  { href: "/oi/", label: "OI" },
  { href: "/earnings/", label: "Earnings" },
  { href: "/calendar/", label: "Calendar" },
  { href: "/etf/", label: "ETF" },
  { href: "/screener/", label: "Screener" },
  { href: "/seasonality/", label: "Seasonality" },
] as const;

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Sections" className="border-b border-border/80 bg-background/80">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 py-2 md:px-6">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1 text-xs whitespace-nowrap",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <TickerSearch />
      </div>
    </nav>
  );
}
