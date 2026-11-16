import { describe, expect, it } from "vitest";
import { normalizeBasePath, withBase } from "./site";

describe("site base path", () => {
  it("builds root links and project-site links", () => {
    expect(normalizeBasePath(undefined)).toBe("");
    expect(normalizeBasePath("")).toBe("");
    expect(withBase("/popout/?symbols=SPY,NVDA&tf=5m", "")).toBe("/popout/?symbols=SPY,NVDA&tf=5m");
    expect(withBase("/data/manifest.json", "")).toBe("/data/manifest.json");
    expect(withBase("/popout/?symbols=SPY,NVDA&tf=5m", "/tradehax-intel")).toBe(
      "/tradehax-intel/popout/?symbols=SPY,NVDA&tf=5m",
    );
    expect(withBase("/data/manifest.json", "/tradehax-intel")).toBe("/tradehax-intel/data/manifest.json");
  });
});
