"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TickerSearch } from "@/components/ticker-search";
import { NAV_GROUPS, NAV_RIGHT, fuzzyScore, matchShortcut, type KeyEvent } from "@/lib/nav/model";
import { DEFAULT_UNIVERSE } from "@/lib/live/universe";
import { chartPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [keys, setKeys] = useState<KeyEvent[]>([]);

  const commands = useMemo(() => {
    const pages = [...NAV_GROUPS.flatMap((group) => group.items), ...NAV_RIGHT].map((item) => ({ href: item.href, label: item.label }));
    const tickers = DEFAULT_UNIVERSE.flatMap((symbol) => [
      { href: chartPath(symbol), label: `${symbol} Chart` },
      { href: `/flow/?symbol=${symbol}`, label: `${symbol} Flow` },
      { href: `/gex/?s=${symbol}`, label: `${symbol} Gamma` },
    ]);
    return [...pages, ...tickers]
      .map((item) => ({ ...item, score: fuzzyScore(query, item.label) }))
      .filter((item) => item.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key === "Escape") setOpen(false);
      if (typing || open) return;
      const next = [...keys, { key: event.key.toLowerCase(), at: Date.now() }].slice(-4);
      setKeys(next);
      const route = matchShortcut(next, Date.now());
      if (route) router.push(route);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, open, router]);

  return (
    <header className="border-b border-border/80 bg-background/90">
      <nav aria-label="Sections" className="mx-auto hidden max-w-[1400px] items-center gap-3 px-4 py-2 md:flex md:px-6">
        {NAV_GROUPS.map((group) => (
          <details key={group.label} className="relative">
            <summary className="cursor-pointer list-none text-xs text-muted-foreground">{group.label}</summary>
            <div className="absolute z-20 mt-2 flex w-44 flex-col rounded-xl border border-border bg-background p-1 shadow-lg">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={cn("rounded-md px-2 py-2 text-sm", pathname === item.href ? "bg-foreground text-background" : "")}>
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {NAV_RIGHT.map((item) => (
            <Link key={item.href} href={item.href} className="text-xs text-muted-foreground">{item.label}</Link>
          ))}
          <TickerSearch />
          <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpen(true)}>Search</button>
        </div>
      </nav>
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background md:hidden">
        {[
          { href: "/", label: "Desk" },
          { href: "/chart/", label: "Chart" },
          { href: "/flow/", label: "Flow" },
          { href: "/gex/", label: "Options" },
          { href: "/screener/", label: "More" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex h-14 flex-1 items-center justify-center text-xs">{item.label}</Link>
        ))}
      </nav>
      {open ? (
        <div className="fixed inset-0 z-30 bg-black/50 p-4" onClick={() => setOpen(false)}>
          <form
            className="mx-auto mt-16 max-w-lg rounded-xl border border-border bg-background p-3"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              const first = commands[0];
              if (first) {
                setOpen(false);
                router.push(first.href);
              }
            }}
          >
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="nvda chart" aria-label="Command" className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <ul className="mt-2">
              {commands.map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href} className="block rounded-md px-2 py-2 text-sm hover:bg-foreground/10" onClick={() => setOpen(false)}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </form>
        </div>
      ) : null}
    </header>
  );
}
