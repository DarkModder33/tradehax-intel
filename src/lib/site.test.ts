import { describe, expect, it } from "vitest";
import { normalizeBasePath, withBase } from "./site";

describe("site base path", () => {
  it("builds root links and project-site links", () => {
    expect(normalizeBasePath(undefined)).toBe("");
    expect(normalizeBasePath("")).toBe("");
    expect(withBase("/popout/?symbols=SPY,NVDA&tf=5m", "")).toBe("/popout/?symbols=SPY,NVDA&tf=5m");
    expect(withBase("/data/manifest.json", "")).toBe("/data/manifest.json");
    expect(withBase("/popout/?symbols=SPY,NVDA&tf=5m", "/project")).toBe("/project/popout/?symbols=SPY,NVDA&tf=5m");
    expect(withBase("/data/manifest.json", "/project")).toBe("/project/data/manifest.json");
  });
});
