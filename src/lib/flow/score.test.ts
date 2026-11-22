import { describe, expect, it } from "vitest";
import { formatOcc } from "@/lib/format";
import { parseOcc } from "@/lib/sources/occ";
import { clippedFactor, unusualScore } from "./score";

const base = {
  premium: 100_000,
  medianPremium: 100_000,
  volume: 10,
  openInterest: 100,
  askSide: false,
  sweep: false,
  otmFraction: 0,
  dte: 30,
  repeats: 0,
  daysToEarnings: null as number | null,
};

describe("unusual score", () => {
  it("rises when a factor rises and clips extremes", () => {
    const quiet = unusualScore(base);
    const louder = unusualScore({ ...base, premium: 2_000_000 });
    const extreme = unusualScore({ ...base, premium: 1e12 });
    expect(louder.score).toBeGreaterThan(quiet.score);
    expect(extreme.score).toBeLessThanOrEqual(100);
    expect(clippedFactor(100, 1)).toBe(1);
    expect(unusualScore({ ...base, sweep: true, askSide: true }).score).toBeGreaterThan(unusualScore({ ...base, sweep: false, askSide: false }).score);
    expect(quiet.status).toBe("scored");
    expect(unusualScore(base, 3).status).toBe("building");
  });

  it("parses and formats an OCC symbol", () => {
    expect(parseOcc("NVDA261218C00200000")?.strike).toBe(200);
    expect(formatOcc("NVDA261218C00200000")).toBe("NVDA 12/18 200C");
  });
});
