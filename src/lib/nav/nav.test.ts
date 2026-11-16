import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_HREFS, UNLISTED_ROUTES, fuzzyScore, matchShortcut, routeFromPage } from "./model";

function pages(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...pages(full));
    else if (entry === "page.tsx") found.push(full);
  }
  return found;
}

describe("navigation", () => {
  it("lists every page except the pop-out and the offline shell", () => {
    const root = path.resolve("src/app");
    const routes = pages(root).map((file) => routeFromPage(path.relative(process.cwd(), file).split(path.sep).join("/")));
    const missing = routes.filter((route) => !NAV_HREFS.includes(route) && !UNLISTED_ROUTES.includes(route));
    expect(missing).toEqual([]);
  });

  it("ranks a chart query above a looser match and times out a shortcut", () => {
    const chart = fuzzyScore("nvda chart", "NVDA Chart");
    const flow = fuzzyScore("nvda chart", "NVDA Flow");
    expect(chart).not.toBeNull();
    expect(flow).toBeNull();
    expect(fuzzyScore("chart", "Chart") ?? 0).toBeGreaterThan(fuzzyScore("chart", "Backtest chart notes") ?? 0);
    expect(matchShortcut([{ key: "g", at: 0 }, { key: "c", at: 400 }], 400)).toBe("/chart/");
    expect(matchShortcut([{ key: "g", at: 0 }, { key: "c", at: 1400 }], 1400)).toBeNull();
  });
});
