import { describe, expect, it } from "vitest";
import { rankSignals } from "./agreement";
import { FACTOR_WEIGHTS, scoreFactors } from "./score";
import { FACTOR_LABEL, type Direction, type Factor, type FactorId } from "./types";

function factor(id: FactorId, score: number, direction: Direction, detail: string): Factor {
  return {
    id,
    label: FACTOR_LABEL[id],
    direction,
    score,
    weight: FACTOR_WEIGHTS[id],
    detail,
  };
}

function board(score: number, direction: Direction): Factor[] {
  return (Object.keys(FACTOR_WEIGHTS) as FactorId[]).map((id) =>
    factor(
      id,
      score,
      direction,
      id === "macd" ? "MACD histogram is positive and expanding, so upside momentum is building." : "The trend is aligned.",
    ),
  );
}

describe("scoreFactors", () => {
  it("keeps the published weights summing to 1", () => {
    const total = Object.values(FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it("scores a unanimous full vote at 100 and keeps acronyms capitalized", () => {
    const result = scoreFactors(board(1, "bullish"));
    expect(result.direction).toBe("bullish");
    expect(result.probability).toBe(100);
    expect(result.net).toBeCloseTo(1, 8);
    expect(result.agreement).toBe(1);
    expect(result.summary).toMatch(/, and MACD histogram/);
  });

  it("mirrors a unanimous bearish vote", () => {
    const result = scoreFactors(board(-1, "bearish"));
    expect(result.direction).toBe("bearish");
    expect(result.probability).toBe(100);
  });

  it("does not let one loud factor look like a full agreement", () => {
    // net = 0.22, agreement = 1, coverage = 0.2
    // (0.22 * 0.7 + 0.3) * (0.7 + 0.06) = 34.504 → 35
    const factors = board(0, "neutral").map((item) =>
      item.id === "ema" ? factor("ema", 1, "bullish", "The 9-period EMA is above the 21 and the gap is widening, so the short-term trend is up.") : item,
    );
    const result = scoreFactors(factors);
    expect(result.direction).toBe("bullish");
    expect(result.probability).toBe(35);
    expect(result.summary).toMatch(/^The 9-period EMA is above the 21/);
  });

  it("calls a canceling board mixed and names both sides", () => {
    const factors = [
      factor("ema", 1, "bullish", "EMA up."),
      factor("macd", -1, "bearish", "MACD down."),
      factor("rsi", 0.5, "bullish", "RSI up."),
      factor("vwap", -0.5, "bearish", "VWAP down."),
      factor("volume", 0, "neutral", "Volume quiet."),
    ];
    const result = scoreFactors(factors);
    expect(result.net).toBeCloseTo(0, 8);
    expect(result.direction).toBe("neutral");
    expect(result.probability).toBe(0);
    expect(result.summary).toBe(
      "No clear lean. EMA 9/21 is bullish while MACD is bearish, and they cancel out.",
    );
  });
});

describe("rankSignals", () => {
  it("orders by confidence and breaks ties by symbol", () => {
    const ranked = rankSignals([
      { symbol: "MSFT", probability: 40 },
      { symbol: "NVDA", probability: 80 },
      { symbol: "AAPL", probability: 80 },
    ]);
    expect(ranked.map((item) => item.symbol)).toEqual(["AAPL", "NVDA", "MSFT"]);
  });
});
