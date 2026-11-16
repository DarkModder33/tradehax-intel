import { describe, expect, it } from "vitest";
import type { ChainSnapshot } from "@/lib/sources/cboe";
import { bsPrice } from "./bs";
import {
  aggregateGreeks,
  bookValue,
  callDeltaCheck,
  decodeLegs,
  encodeLegs,
  expectedValue,
  legValueAt,
  maxProfitLoss,
  presetLegs,
  probabilityOfProfit,
  strategyCurve,
  type StrategyLeg,
} from "./strategy";

function contract(partial: { symbol: string; expiry: string; right: "call" | "put"; strike: number; bid: number; ask: number; iv?: number }) {
  return {
    root: "ZZ",
    delta: partial.right === "call" ? 0.5 : -0.5,
    gamma: 0.02,
    vega: 0.1,
    theta: -0.02,
    rho: 0,
    theo: (partial.bid + partial.ask) / 2,
    openInterest: 10,
    volume: 1,
    last: (partial.bid + partial.ask) / 2,
    lastTradeTime: null,
    iv: 0.2,
    ...partial,
  };
}

describe("strategy v2", () => {
  it("matches a zero-rate Black-Scholes price to the cent", () => {
    const price = bsPrice({ spot: 100, strike: 100, timeYears: 1, sigma: 0.2, right: "call" });
    expect(price).toBeCloseTo(7.965567, 2);
  });

  it("is intrinsic at expiry and model-priced before it", () => {
    const leg: StrategyLeg = { right: "call", side: 1, strike: 100, premium: 2, quantity: 1, expiry: "2026-12-18", iv: 0.2 };
    expect(legValueAt(leg, 110, new Date("2026-12-19T00:00:00Z"))).toBeCloseTo(800, 6);
    const before = new Date("2026-06-18T21:00:00Z");
    const time = (Date.parse("2026-12-18T21:00:00Z") - before.getTime()) / (365 * 24 * 60 * 60 * 1000);
    const model = (bsPrice({ spot: 100, strike: 100, timeYears: time, sigma: 0.2, right: "call" }) - 2) * 100;
    expect(legValueAt(leg, 100, before)).toBeCloseTo(model, 6);
  });

  it("flags a naked short call and prices a defined iron condor", () => {
    const naked = maxProfitLoss([{ right: "call", side: -1, strike: 100, premium: 2, quantity: 1 }]);
    expect(naked.unboundedLoss).toBe(true);
    expect(naked.maxLoss).toBeNull();
    const condor: StrategyLeg[] = [
      { right: "put", side: 1, strike: 90, premium: 0.4, quantity: 1 },
      { right: "put", side: -1, strike: 95, premium: 1.2, quantity: 1 },
      { right: "call", side: -1, strike: 105, premium: 1.2, quantity: 1 },
      { right: "call", side: 1, strike: 110, premium: 0.4, quantity: 1 },
    ];
    const bounded = maxProfitLoss(condor);
    expect(bounded.unboundedLoss).toBe(false);
    expect(bounded.maxLoss).toBeCloseTo(340, 0);
    expect(bounded.maxProfit).toBeCloseTo(160, 0);
  });

  it("picks the at-the-money strike for a long call", () => {
    const chain = {
      symbol: "ZZ",
      spot: 100,
      iv30: 0.2,
      asOf: null,
      volume: 1,
      source: "Cboe delayed",
      delay: "about 15 min",
      contracts: [90, 100, 110].flatMap((strike) => [
        contract({ symbol: `C${strike}`, expiry: "2026-12-18", right: "call", strike, bid: 1, ask: 1.2 }),
        contract({ symbol: `P${strike}`, expiry: "2026-12-18", right: "put", strike, bid: 1, ask: 1.2 }),
      ]),
    } as ChainSnapshot;
    const preset = presetLegs(chain, "2026-12-18", "long-call");
    expect(preset.legs).toHaveLength(1);
    expect(preset.legs[0].strike).toBe(100);
    expect(preset.legs[0].side).toBe(1);
  });

  it("keeps time on the back leg of a calendar", () => {
    const chain = {
      symbol: "ZZ",
      spot: 100,
      iv30: 0.2,
      asOf: null,
      volume: 1,
      source: "Cboe delayed",
      delay: "about 15 min",
      contracts: ["2026-12-18", "2027-03-19"].flatMap((expiry) => [
        contract({ symbol: `${expiry}C`, expiry, right: "call", strike: 100, bid: 2, ask: 2.2, iv: 0.25 }),
      ]),
    } as ChainSnapshot;
    const book = presetLegs(chain, "2026-12-18", "calendar");
    const asOf = new Date("2026-12-20T00:00:00Z");
    const back = book.legs.find((leg) => leg.expiry === "2027-03-19");
    expect(back).toBeTruthy();
    const front = bookValue([book.legs[0]], null, 100, asOf);
    const onlyBack = bookValue([back!], null, 100, asOf);
    expect(front).not.toBeCloseTo(onlyBack, 0);
    expect(onlyBack).not.toBe(0);
  });

  it("puts a long at-the-money call near N(d2)", () => {
    const spots = Array.from({ length: 401 }, (_, index) => 20 + index * 0.4);
    const curve = strategyCurve([{ right: "call", side: 1, strike: 100, premium: 0, quantity: 1 }], spots);
    const pop = probabilityOfProfit(curve, 100, 0.2, 1);
    expect(pop).not.toBeNull();
    expect(Math.abs((pop ?? 0) - callDeltaCheck(100, 100, 0.2, 1))).toBeLessThan(0.02);
    expect(expectedValue(curve, 100, 0.2, 1)).not.toBeNull();
  });

  it("round-trips a shared book and sums dollar greeks", () => {
    const legs: StrategyLeg[] = [{ right: "call", side: 1, strike: 100, premium: 2, quantity: 1, expiry: "2027-11-16", iv: 0.2 }];
    const decoded = decodeLegs(encodeLegs(legs, null));
    expect(decoded?.legs[0].strike).toBe(100);
    const greeks = aggregateGreeks(legs, 100, new Date("2026-11-16T00:00:00Z"));
    expect(greeks.delta).toBeGreaterThan(0);
    expect(greeks.vega).toBeGreaterThan(0);
  });
});
