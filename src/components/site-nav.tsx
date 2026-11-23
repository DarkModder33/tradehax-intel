"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Activity, Gauge, LayoutDashboard, Menu, Newspaper, Search, X } from "lucide-react";
import { BrandLink } from "@/components/brand";
import { NAV_GROUPS, NAV_RIGHT, fuzzyScore, matchShortcut, type KeyEvent } from "@/lib/nav/model";
import { DEFAULT_UNIVERSE } from "@/lib/live/universe";
import { chartPath, tickerPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

const TICKER = /^[A-Z][A-Z0-9.]{0,9}$/;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [keys, setKeys] = useState<KeyEvent[]>([]);

  const commands = useMemo(() => {
    const pages = [...NAV_GROUPS.flatMap((group) => group.items), ...NAV_RIGHT].map((item) => ({ href: item.href, label: item.label }));
    const tickers = DEFAULT_UNIVERSE.flatMap((symbol) => [
      { href: tickerPath(symbol), label: `${symbol} Overview` },
      { href: chartPath(symbol), label: `${symbol} Chart` },
      { href: `/flow/?symbol=${symbol}`, label: `${symbol} Flow` },
      { href: `/gex/?s=${symbol}`, label: `${symbol} Gamma` },
    ]);
    const ranked = [...pages, ...tickers]
      .map((item) => ({ ...item, score: fuzzyScore(query, item.label) }))
      .filter((item) => item.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 8);
    const typed = query.trim().toUpperCase();
    // Any ticker works, not only the default universe: offer its overview first.
    if (TICKER.test(typed) && !ranked.some((item) => item.label === `${typed} Overview`)) {
      return [{ href: tickerPath(typed), label: `${typed} Overview`, score: 99 }, ...ranked].slice(0, 8);
    }
    return ranked;
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
      if (event.key === "Escape") {
        setOpen(false);
        setMenu(false);
      }
      if (typing || open) return;
      const next = [...keys, { key: event.key.toLowerCase(), at: Date.now() }].slice(-4);
      setKeys(next);
      const route = matchShortcut(next, Date.now());
      if (route) router.push(route);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, open, router]);

  const groupActive = (items: { href: string }[]) => items.some((item) => item.href !== "/" && isActive(pathname, item.href));

  // The mobile bar and overlays sit outside the header: its backdrop-filter would
  // otherwise become their containing block and pin them to the top.
  return (
    <>
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0b0e14]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0b0e14]/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 md:px-6">
        <BrandLink />
        <nav aria-label="Sections" className="hidden items-center gap-0.5 lg:flex">
          <Link href="/news/" className={cn("nav-pill", isActive(pathname, "/news/") && "nav-pill-active")}>News</Link>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="group relative">
              <button type="button" className={cn("nav-pill", groupActive(group.items) && "nav-pill-active")} aria-haspopup="true">
                {group.label}
              </button>
              <div className="invisible absolute top-full left-0 z-50 pt-2 opacity-0 transition duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="flex w-52 flex-col rounded-xl border border-white/10 bg-[#121722] p-1.5 shadow-2xl shadow-black/50">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm text-foreground/85 transition-colors hover:bg-white/[0.06] hover:text-foreground",
                        pathname === item.href && "bg-gold/10 text-gold",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
            aria-label="Search tickers and pages"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search ticker or page</span>
            <kbd className="hidden rounded border border-white/10 px-1.5 font-mono text-[10px] md:inline">⌘K</kbd>
          </button>
          <Link href="/status/" className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground xl:flex">
            <span className="size-1.5 rounded-full bg-bullish shadow-[0_0_8px] shadow-bullish" />
            Status
          </Link>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground lg:hidden"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>
    </header>

      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#0b0e14]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {[
          { href: "/", label: "Desk", icon: LayoutDashboard },
          { href: "/news/", label: "News", icon: Newspaper },
          { href: "/flow/", label: "Flow", icon: Activity },
          { href: "/gex/", label: "Gamma", icon: Gauge },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground", isActive(pathname, item.href) && "text-gold")}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
        <button type="button" onClick={() => setMenu(true)} className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <Menu className="size-4" />
          More
        </button>
      </nav>

      {menu ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMenu(false)}>
          <div
            className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto border-l border-white/10 bg-[#0d1119] p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="All sections"
          >
            <div className="mb-4 flex items-center justify-between">
              <BrandLink />
              <button type="button" aria-label="Close menu" className="flex size-9 items-center justify-center rounded-full border border-white/10" onClick={() => setMenu(false)}>
                <X className="size-4" />
              </button>
            </div>
            <Link href="/news/" onClick={() => setMenu(false)} className="mb-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-sm font-medium text-gold">
              News wire
            </Link>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-1.5 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{group.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenu(false)}
                      className={cn("rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm", pathname === item.href && "border-gold/40 text-gold")}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-xs text-muted-foreground">
              {NAV_RIGHT.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenu(false)}>{item.label}</Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form
            className="mx-auto mt-[12vh] max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#121722] shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              const first = commands[0];
              if (first) {
                setOpen(false);
                setQuery("");
                router.push(first.href);
              }
            }}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a ticker (NVDA) or a page (gamma)"
                aria-label="Search tickers and pages"
                className="h-13 w-full bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {commands.map((item, index) => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-white/[0.06]", index === 0 && "bg-white/[0.04]")}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    {index === 0 ? <span className="text-[10px] text-muted-foreground">Enter</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </form>
        </div>
      ) : null}
    </>
  );
}
