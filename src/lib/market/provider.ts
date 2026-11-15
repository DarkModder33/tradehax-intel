import type { Timeframe } from "@/lib/indicators/types";
import type { SymbolSnapshot } from "./types";

/**
 * Swap point for market data. v1 ships Yahoo Finance's public chart endpoint
 * and a simulated fallback. A later provider (Polygon, Tradier, a paid flow
 * feed) only has to implement this.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: "live" | "demo";
  readonly disclaimer: string;
  load(symbol: string, timeframes: readonly Timeframe[]): Promise<SymbolSnapshot>;
}

export class MarketDataError extends Error {
  readonly symbol: string | undefined;

  constructor(message: string, symbol?: string) {
    super(message);
    this.name = "MarketDataError";
    this.symbol = symbol;
  }
}
