import type { Bar, Signal, Timeframe } from "@/lib/indicators/types";

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  changePercent: number | null;
  currency: string;
  asOf: number;
}

export interface SymbolSnapshot {
  quote: Quote;
  bars: Partial<Record<Timeframe, Bar[]>>;
}

export interface DataSource {
  id: string;
  kind: "live" | "demo";
  label: string;
  disclaimer: string;
  /** Set when a live provider failed and the board fell back to simulated prices. */
  fallbackReason: string | null;
}

export interface SymbolError {
  symbol: string;
  message: string;
}

export interface DashboardPayload {
  source: DataSource;
  updatedAt: number;
  quotes: Quote[];
  signals: Signal[];
  errors: SymbolError[];
}

export type { Bar, Signal, Timeframe };
