import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function pages(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...pages(full));
    else if (entry === "page.tsx") found.push(full);
  }
  return found;
}

describe("page titles", () => {
  it("gives every route a unique title", () => {
    const titles = pages(path.resolve("src/app")).map((file) => {
      const source = readFileSync(file, "utf8");
      const match = source.match(/title:\s*"([^"]+)"/);
      if (match) return match[1];
      if (source.includes("generateMetadata")) return `generated:${path.relative(path.resolve("src/app"), file)}`;
      return file.endsWith(`${path.sep}app${path.sep}page.tsx`) ? "TradeHax Intel" : "";
    });
    expect(titles.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
