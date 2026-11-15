/** One OHLCV bar. `time` is the bar open, in Unix milliseconds. */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Direction = "bullish" | "bearish" | "neutral";

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1D",
};

export const FACTOR_IDS = ["ema", "macd", "rsi", "vwap", "volume"] as const;

export type FactorId = (typeof FACTOR_IDS)[number];

export const FACTOR_LABEL: Record<FactorId, string> = {
  ema: "EMA 9/21",
  macd: "MACD",
  rsi: "RSI",
  vwap: "VWAP",
  volume: "Volume",
};

/** One indicator's vote. `score` is -1 (bearish) to +1 (bullish). */
export interface Factor {
  id: FactorId;
  label: string;
  direction: Direction;
  score: number;
  /** Share of the model. The five weights sum to 1. */
  weight: number;
  detail: string;
}

export interface Signal {
  symbol: string;
  timeframe: Timeframe;
  direction: Direction;
  /** 0–100 model confidence in `direction`. Not a historical win rate. */
  probability: number;
  /** Weighted vote from -1 to +1, before the agreement adjustment. */
  net: number;
  /** Share of the factors that took a side and match `direction`, from 0 to 1. */
  agreement: number;
  summary: string;
  factors: Factor[];
  price: number;
  asOf: number;
  barCount: number;
  /** Recent closes, oldest first, for a small sparkline. */
  trail: number[];
}
