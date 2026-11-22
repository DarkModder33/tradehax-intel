import { describe, expect, it } from "vitest";
import { cacheControl, isHeavy, printsFromHistory, rateLimit } from "../../../worker/src/guard";

describe("worker guard", () => {
  it("caches GETs for 15 seconds and limits heavy routes", () => {
    expect(cacheControl("/v1/bars/SPY")).toBe("public, max-age=15");
    expect(cacheControl("/v1/stream")).toBe("no-cache");
    expect(isHeavy("/v1/bars/SPY")).toBe(true);
    expect(isHeavy("/v1/flow")).toBe(false);
    const first = rateLimit([], 1_000);
    expect(first.allowed).toBe(true);
    const full = rateLimit(Array.from({ length: 60 }, (_, index) => 1_000 + index), 1_050);
    expect(full.allowed).toBe(false);
    expect(printsFromHistory({ rows: [{ contract: "X" }] })).toHaveLength(1);
  });
});
