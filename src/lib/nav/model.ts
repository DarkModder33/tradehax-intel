export interface NavItem {
  href: string;
  label: string;
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Top-level sections. A group with one item renders as a plain link. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Markets",
    items: [
      { href: "/", label: "Home" },
      { href: "/desk/", label: "Signal desk", keywords: "dashboard watchlist" },
      { href: "/markets/", label: "Overview" },
      { href: "/chart/", label: "Chart" },
      { href: "/screener/", label: "Screener" },
      { href: "/map/", label: "Heat map" },
      { href: "/rotation/", label: "Sector rotation" },
      { href: "/macro/", label: "Macro" },
      { href: "/calendar/", label: "Economic calendar" },
      { href: "/seasonality/", label: "Seasonality" },
      { href: "/etf/", label: "ETF flows" },
      { href: "/spx/", label: "SPX" },
    ],
  },
  {
    label: "Flow",
    items: [
      { href: "/flow/", label: "Options tape" },
      { href: "/flow/alerts/", label: "Unusual activity" },
      { href: "/flow/hot/", label: "Hot contracts" },
      { href: "/tide/", label: "Market tide" },
      { href: "/flow/interval/", label: "Interval" },
      { href: "/flow/history/", label: "History" },
      { href: "/offex/", label: "Dark pool" },
    ],
  },
  {
    label: "Options",
    items: [
      { href: "/gex/", label: "Dealer gamma" },
      { href: "/chain/", label: "Chain" },
      { href: "/vol/", label: "Volatility" },
      { href: "/oi/", label: "Open interest" },
      { href: "/strategy/", label: "Strategy builder" },
      { href: "/c/", label: "Contract" },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/t/", label: "Ticker" },
      { href: "/earnings/", label: "Earnings moves" },
      { href: "/congress/", label: "Congress trades" },
      { href: "/insiders/", label: "Insiders" },
      { href: "/shorts/", label: "Short interest" },
      { href: "/institutions/", label: "13F" },
      { href: "/backtest/", label: "Backtest" },
      { href: "/lab/", label: "Lab" },
      { href: "/portfolio/", label: "Portfolio" },
      { href: "/workspace/", label: "Workspace" },
    ],
  },
  { label: "News", items: [{ href: "/news/", label: "News" }] },
  { label: "Alerts", items: [{ href: "/alerts/", label: "Alerts" }, { href: "/alerts/rules/", label: "Alert rules" }] },
];

export const NAV_RIGHT: NavItem[] = [
  { href: "/about/", label: "About" },
  { href: "/about/methodology/", label: "Methodology" },
  { href: "/status/", label: "Status" },
];

export const NAV_HREFS = [...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)), ...NAV_RIGHT.map((item) => item.href)];

/** Routes that are tools, not sections. A new page must be added to the nav or this list. */
export const UNLISTED_ROUTES = ["/popout/", "/offline/", "/news/[year]/[month]/[slug]/", "/news/t/[ticker]/", "/news/type/[type]/"];

export function routeFromPage(file: string): string {
  const cleaned = file.replace(/^src\/app/, "").replace(/\/page\.tsx$/, "") || "/";
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

export function fuzzyScore(query: string, text: string): number | null {
  const needle = query.trim().toLowerCase();
  const hay = text.toLowerCase();
  if (!needle) return 0;
  let score = 0;
  let cursor = 0;
  for (const char of needle) {
    const found = hay.indexOf(char, cursor);
    if (found < 0) return null;
    score += found === cursor ? 3 : 1;
    cursor = found + 1;
  }
  if (hay.startsWith(needle)) score += 5;
  return score;
}

export interface KeyEvent {
  key: string;
  at: number;
}

/** `g` then a letter within a second. Returns the route or null. */
export function matchShortcut(events: KeyEvent[], now: number): string | null {
  const recent = events.filter((event) => now - event.at <= 1000);
  if (recent.length < 2) return null;
  const [first, second] = recent.slice(-2);
  if (first.key !== "g" || now - first.at > 1000) return null;
  const routes: Record<string, string> = { c: "/chart/", f: "/flow/", g: "/gex/", s: "/screener/", b: "/backtest/", p: "/portfolio/" };
  return routes[second.key] ?? null;
}
