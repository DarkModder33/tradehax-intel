export interface NavItem {
  href: string;
  label: string;
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: "Desk", items: [{ href: "/", label: "Desk" }, { href: "/t/", label: "Ticker" }, { href: "/alerts/", label: "Alerts" }, { href: "/screener/", label: "Screener" }] },
  {
    label: "Charts",
    items: [
      { href: "/chart/", label: "Chart" },
      { href: "/backtest/", label: "Backtest" },
      { href: "/seasonality/", label: "Seasonality" },
      { href: "/markets/", label: "Markets" },
    ],
  },
  {
    label: "Options",
    items: [
      { href: "/chain/", label: "Chain" },
      { href: "/gex/", label: "Gamma" },
      { href: "/vol/", label: "Vol" },
      { href: "/strategy/", label: "Strategy" },
      { href: "/oi/", label: "OI" },
      { href: "/flow/hot/", label: "Hot" },
    ],
  },
  {
    label: "Flow",
    items: [
      { href: "/flow/", label: "Tape" },
      { href: "/flow/alerts/", label: "Flow alerts" },
      { href: "/flow/interval/", label: "Interval" },
      { href: "/flow/history/", label: "History" },
      { href: "/tide/", label: "Tide" },
    ],
  },
  {
    label: "Structure",
    items: [
      { href: "/offex/", label: "Off-ex" },
      { href: "/shorts/", label: "Shorts" },
      { href: "/spx/", label: "SPX" },
      { href: "/map/", label: "Map" },
    ],
  },
  {
    label: "Filings",
    items: [
      { href: "/insiders/", label: "Insiders" },
      { href: "/congress/", label: "Congress" },
      { href: "/institutions/", label: "13F" },
    ],
  },
  {
    label: "Calendar",
    items: [
      { href: "/earnings/", label: "Earnings" },
      { href: "/calendar/", label: "Economic" },
      { href: "/etf/", label: "ETF" },
    ],
  },
];

export const NAV_RIGHT: NavItem[] = [
  { href: "/portfolio/", label: "Portfolio" },
  { href: "/workspace/", label: "Workspace" },
  { href: "/about/", label: "About" },
  { href: "/status/", label: "Status" },
];

export const NAV_HREFS = [...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)), ...NAV_RIGHT.map((item) => item.href)];

/** Routes that are tools, not sections. A new page must be added to the nav or this list. */
export const UNLISTED_ROUTES = ["/popout/", "/offline/"];

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
