import type { Quote } from "./types";
import type { CnbcQuote } from "./cnbc";

export interface PriceGap {
  symbol: string;
  primary: number;
  secondary: number;
  gapPct: number;
}

export interface DataHealth {
  primaryLabel: string;
  secondaryLabel: string;
  status: "agrees" | "disagrees" | "unavailable" | "demo";
  detail: string;
  gaps: PriceGap[];
  asOf: number | null;
}

const GAP_LIMIT = 0.015;

export function comparePrices(primary: Quote[], secondary: CnbcQuote[], limit = GAP_LIMIT): PriceGap[] {
  const bySymbol = new Map(secondary.map((quote) => [quote.symbol, quote.price]));
  const gaps: PriceGap[] = [];
  for (const quote of primary) {
    const other = bySymbol.get(quote.symbol);
    if (other == null || quote.price === 0) continue;
    const gapPct = Math.abs(quote.price - other) / quote.price;
    if (gapPct > limit) {
      gaps.push({ symbol: quote.symbol, primary: quote.price, secondary: other, gapPct });
    }
  }
  return gaps.sort((a, b) => b.gapPct - a.gapPct);
}

export function describeHealth(input: {
  primaryLabel: string;
  kind: "live" | "demo";
  secondaryOk: boolean;
  gaps: PriceGap[];
  asOf: number | null;
}): DataHealth {
  if (input.kind === "demo") {
    return {
      primaryLabel: input.primaryLabel,
      secondaryLabel: "CNBC",
      status: "demo",
      detail: "Demo prices are simulated, so there is nothing to cross-check.",
      gaps: [],
      asOf: input.asOf,
    };
  }
  if (!input.secondaryOk) {
    return {
      primaryLabel: input.primaryLabel,
      secondaryLabel: "CNBC",
      status: "unavailable",
      detail: "CNBC did not answer the quote check. Yahoo is the only live source on this refresh.",
      gaps: [],
      asOf: input.asOf,
    };
  }
  if (input.gaps.length === 0) {
    return {
      primaryLabel: input.primaryLabel,
      secondaryLabel: "CNBC",
      status: "agrees",
      detail: "Yahoo and CNBC last prices agree within 1.5%.",
      gaps: [],
      asOf: input.asOf,
    };
  }
  const first = input.gaps[0];
  return {
    primaryLabel: input.primaryLabel,
    secondaryLabel: "CNBC",
    status: "disagrees",
    detail: `${first.symbol} differs by ${(first.gapPct * 100).toFixed(1)}% (Yahoo ${first.primary.toFixed(2)}, CNBC ${first.secondary.toFixed(2)}).`,
    gaps: input.gaps,
    asOf: input.asOf,
  };
}
