"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Desk" },
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
      </div>
    </nav>
  );
}
