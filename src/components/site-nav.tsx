"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, Menu, Newspaper, Activity, Search, X } from "lucide-react";
import { BrandLink } from "@/components/brand";
import { HOVER_CLOSE_MS, HOVER_OPEN_MS, MENU_CLOSED, isInside, menuReducer } from "@/lib/nav/menu-state";
import { NAV_GROUPS, NAV_RIGHT, fuzzyScore, matchShortcut, type KeyEvent } from "@/lib/nav/model";
import { DEFAULT_UNIVERSE } from "@/lib/live/universe";
import { chartPath, tickerPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

const TICKER = /^[A-Z][A-Z0-9.]{0,9}$/;
const PALETTE = "palette";
const DRAWER = "drawer";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [state, dispatch] = useReducer(menuReducer, MENU_CLOSED);
  const [query, setQuery] = useState("");
  const [keys, setKeys] = useState<KeyEvent[]>([]);
  const headerRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  const pointerFocus = useRef(false);
  const hoverOpenedAt = useRef(0);
  const open = state.open;

  const clearTimer = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const later = useCallback((fn: () => void, ms: number) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  }, []);

  // Route change closes everything, including a palette or drawer link that navigated.
  useEffect(() => {
    dispatch({ type: "route" });
  }, [pathname]);

  // Outside click: anything not inside the header, drawer or palette.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!isInside(event.target, [headerRef.current, drawerRef.current, paletteRef.current])) dispatch({ type: "outside" });
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open === PALETTE) window.setTimeout(() => inputRef.current?.focus(), 0);
    document.body.style.overflow = open === PALETTE || open === DRAWER ? "hidden" : "";
  }, [open]);

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
    if (TICKER.test(typed) && !ranked.some((item) => item.label === `${typed} Overview`)) {
      const ticker = { href: tickerPath(typed), label: `${typed} Overview`, score: 99 };
      // "gamma" means the page; "GME" means the ticker. A page whose name contains the text wins.
      const pageHit = ranked.find((item) => !item.label.endsWith("Overview") && item.label.toLowerCase().includes(query.trim().toLowerCase()));
      return (pageHit ? [pageHit, ticker, ...ranked.filter((item) => item !== pageHit)] : [ticker, ...ranked]).slice(0, 8);
    }
    return ranked;
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dispatch({ type: "toggle", id: PALETTE });
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        dispatch({ type: "open", id: PALETTE });
        return;
      }
      if (event.key === "Escape") {
        if (open && open !== PALETTE && open !== DRAWER) {
          headerRef.current?.querySelector<HTMLButtonElement>(`[data-menu="${open}"]`)?.focus();
        }
        dispatch({ type: "escape" });
        return;
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

  const select = () => {
    clearTimer();
    dispatch({ type: "select" });
    setQuery("");
  };

  const groupActive = (items: { href: string }[]) => items.some((item) => isActive(pathname, item.href));

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08090b]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-6 px-4 md:px-6">
          <BrandLink />
          <nav aria-label="Sections" className="hidden h-full items-center lg:flex">
            {NAV_GROUPS.map((group) => {
              if (group.items.length === 1 || group.label === "News") {
                const item = group.items[0];
                return (
                  <Link key={group.label} href={item.href} onClick={select} className={cn("nav-link", isActive(pathname, item.href) && "nav-link-active")}>
                    {group.label}
                  </Link>
                );
              }
              const expanded = open === group.label;
              const id = `menu-${group.label.toLowerCase()}`;
              return (
                <div
                  key={group.label}
                  className="relative flex h-full items-center"
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "mouse") return;
                    later(() => {
                      hoverOpenedAt.current = Date.now();
                      dispatch({ type: "open", id: group.label });
                    }, open && open !== PALETTE && open !== DRAWER ? 0 : HOVER_OPEN_MS);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "mouse") return;
                    later(() => dispatch({ type: "close", id: group.label }), HOVER_CLOSE_MS);
                  }}
                >
                  <button
                    type="button"
                    data-menu={group.label}
                    className={cn("nav-link gap-1", (expanded || groupActive(group.items)) && "nav-link-active")}
                    aria-haspopup="menu"
                    aria-expanded={expanded}
                    aria-controls={id}
                    onPointerDown={() => {
                      pointerFocus.current = true;
                    }}
                    onFocus={() => {
                      // Keyboard focus opens; a click is handled by onClick.
                      if (!pointerFocus.current) dispatch({ type: "open", id: group.label });
                      pointerFocus.current = false;
                    }}
                    onClick={(event) => {
                      clearTimer();
                      // A click right after hover opened the menu keeps it open instead of closing it.
                      if (event.detail > 0 && expanded && Date.now() - hoverOpenedAt.current < 600) return;
                      dispatch({ type: "toggle", id: group.label });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        dispatch({ type: "open", id: group.label });
                        window.setTimeout(() => document.querySelector<HTMLAnchorElement>(`#${id} a`)?.focus(), 0);
                      }
                    }}
                  >
                    {group.label}
                    <ChevronDown className={cn("size-3 opacity-60 transition-transform duration-150", expanded && "rotate-180")} />
                  </button>
                  <div
                    id={id}
                    role="menu"
                    aria-label={group.label}
                    data-state={expanded ? "open" : "closed"}
                    className="menu-panel absolute top-full left-0 z-50 pt-1"
                    onBlur={(event) => {
                      if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) dispatch({ type: "close", id: group.label });
                    }}
                  >
                    <div className="grid w-56 gap-px rounded-md border border-white/[0.08] bg-[#0f1115] p-1 shadow-xl shadow-black/60">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          tabIndex={expanded ? 0 : -1}
                          onClick={select}
                          className={cn(
                            "rounded px-3 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:bg-white/[0.05] focus-visible:outline-none",
                            pathname === item.href && "text-gold",
                          )}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "toggle", id: PALETTE })}
              className="flex h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
              aria-label="Search tickers and pages"
              aria-haspopup="dialog"
              aria-expanded={open === PALETTE}
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded bg-white/[0.06] px-1 font-mono text-[10px] md:inline">⌘K</kbd>
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md border border-white/[0.08] text-foreground lg:hidden"
              aria-label={open === DRAWER ? "Close menu" : "Open menu"}
              aria-haspopup="dialog"
              aria-expanded={open === DRAWER}
              aria-controls="nav-drawer"
              onClick={() => dispatch({ type: "toggle", id: DRAWER })}
            >
              {open === DRAWER ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.06] bg-[#08090b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {[
          { href: "/", label: "Home", icon: LayoutDashboard },
          { href: "/alerts/", label: "Alerts", icon: Bell },
          { href: "/flow/", label: "Flow", icon: Activity },
          { href: "/news/", label: "News", icon: Newspaper },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={select}
            className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground", isActive(pathname, item.href) && "text-foreground")}
          >
            <item.icon className={cn("size-4", isActive(pathname, item.href) && "text-gold")} />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open === DRAWER}
          onClick={() => dispatch({ type: "toggle", id: DRAWER })}
          className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground", open === DRAWER && "text-foreground")}
        >
          <Menu className="size-4" />
          More
        </button>
      </nav>

      <div
        data-state={open === DRAWER ? "open" : "closed"}
        className="overlay fixed inset-0 z-50 bg-black/60 lg:hidden"
        onClick={() => dispatch({ type: "outside" })}
        aria-hidden={open !== DRAWER}
      >
        <div
          ref={drawerRef}
          id="nav-drawer"
          className="drawer absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto border-l border-white/[0.06] bg-[#0b0c0f] px-4 pt-3 pb-20"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="All sections"
        >
          <div className="mb-4 flex h-9 items-center justify-between">
            <BrandLink />
            <button type="button" aria-label="Close menu" className="flex size-8 items-center justify-center rounded-md border border-white/[0.08]" onClick={() => dispatch({ type: "close" })}>
              <X className="size-4" />
            </button>
          </div>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-muted-foreground">{group.label}</p>
              <div className="grid">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    tabIndex={open === DRAWER ? 0 : -1}
                    onClick={select}
                    className={cn("rounded px-2 py-2 text-sm text-foreground/85 hover:bg-white/[0.04]", pathname === item.href && "text-gold")}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-white/[0.06] px-2 pt-4 text-xs text-muted-foreground">
            {NAV_RIGHT.map((item) => (
              <Link key={item.href} href={item.href} tabIndex={open === DRAWER ? 0 : -1} onClick={select}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div
        data-state={open === PALETTE ? "open" : "closed"}
        className="overlay fixed inset-0 z-50 bg-black/60 p-4"
        onClick={() => dispatch({ type: "outside" })}
        aria-hidden={open !== PALETTE}
      >
        <form
          ref={paletteRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="palette mx-auto mt-[12vh] max-w-lg overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f1115] shadow-2xl shadow-black/70"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            const first = commands[0];
            if (first) {
              select();
              router.push(first.href);
            }
          }}
        >
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4">
            <Search className="size-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              tabIndex={open === PALETTE ? 0 : -1}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ticker (NVDA) or page (gamma)"
              aria-label="Search tickers and pages"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-1">
            {commands.map((item, index) => (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  tabIndex={open === PALETTE ? 0 : -1}
                  className={cn("flex items-center justify-between rounded px-3 py-2 text-sm hover:bg-white/[0.05]", index === 0 && "bg-white/[0.03]")}
                  onClick={select}
                >
                  {item.label}
                  {index === 0 ? <span className="text-[10px] text-muted-foreground">Enter</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </form>
      </div>
    </>
  );
}
