import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCompact, formatDigits, formatEtClock, formatOcc, formatSignedPercent } from "./format";

function files(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...files(full));
    else if (entry.endsWith(".tsx")) found.push(full);
  }
  return found;
}

describe("formatters", () => {
  it("compacts money, signs percents, prints ET, and shortens OCC symbols", () => {
    expect(formatCompact(1_240_000)).toBe("$1.24M");
    expect(formatCompact(12_300, false)).toBe("12.3K");
    expect(formatCompact(-500)).toBe("-$500");
    expect(formatSignedPercent(0.123, 1)).toBe("+12.3%");
    expect(formatSignedPercent(-0.5, 0)).toBe("-50%");
    expect(formatOcc("NVDA261218C00200000")).toBe("NVDA 12/18 200C");
    expect(formatDigits(1.2, 2)).toBe("1.20");
    expect(formatEtClock(Date.parse("2026-11-16T21:00:00Z"))).toMatch(/PM ET|AM ET/);
  });

  it("keeps toFixed out of components", () => {
    const hits = files(path.resolve("src/components")).filter((file) => readFileSync(file, "utf8").includes(".toFixed("));
    expect(hits).toEqual([]);
  });
});
