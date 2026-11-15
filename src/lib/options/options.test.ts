import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCboeChain } from "@/lib/sources/cboe";
import { bsDelta } from "./bs";
import { buildExposure } from "./exposure";
import { expectedMove } from "./expectedMove";
import { hotContracts, putCallVolume } from "./hot";
import { maxPain } from "./maxpain";
import { skew25, termStructure } from "./iv";
import { breakevens, legPayoff, strategyCurve } from "./strategy";

const payload = JSON.parse(readFileSync(new URL("../../../fixtures/cboe-spy-2026-11-13.json", import.meta.url), "utf8"));
const chain = parseCboeChain(payload, "SPY");
const asOf = new Date("2026-11-13T21:00:00Z");

describe("SPY 2026-11-13 chain", () => {
  it("matches the published gamma, walls, max pain, and expected move", () => {
    const book = buildExposure(chain, asOf);
    expect(chain.spot).toBeCloseTo(754.37);
    expect(book.byExpiry).toHaveLength(32);
    expect(book.levels.netGex / 1e9).toBeCloseTo(-7.71, 2);
    expect(book.levels.callWall).toBe(775);
    expect(book.levels.putWall).toBe(750);
    expect(book.levels.regime).toBe("dealer short gamma");
    const front = chain.contracts.filter((contract) => contract.expiry === "2026-11-16");
    const next = chain.contracts.filter((contract) => contract.expiry === "2026-11-20");
    expect(maxPain(front)).toBe(762);
    expect(expectedMove(chain.contracts, chain.spot, "2026-11-16")?.percent).toBeCloseTo(0.0085, 3);
    expect(expectedMove(chain.contracts, chain.spot, "2026-11-20")?.percent).toBeCloseTo(0.0178, 3);
    expect(putCallVolume(chain.contracts)).toBeCloseTo(1.14, 2);
    expect(hotContracts(chain.contracts)).toHaveLength(763);
    expect(termStructure(chain.contracts, chain.spot, asOf).some((point) => point.iv != null)).toBe(true);
    expect(skew25(front, "2026-11-16")).not.toBeNull();
    expect(next.length).toBeGreaterThan(0);
  });
});

describe("black scholes and strategy payoff", () => {
  it("prices an at-the-money delta near one half before rates", () => {
    expect(bsDelta({ spot: 100, strike: 100, timeYears: 1, sigma: 0.2, right: "call" })).toBeCloseTo(0.5398, 3);
  });

  it("finds the breakeven of a long call", () => {
    const curve = strategyCurve([{ right: "call", side: 1, strike: 100, premium: 2, quantity: 1 }], [90, 100, 102, 110]);
    expect(legPayoff({ right: "call", side: 1, strike: 100, premium: 2, quantity: 1 }, 110)).toBeCloseTo(800);
    expect(breakevens(curve)[0]).toBeCloseTo(102, 1);
  });
});
