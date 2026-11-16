export const CHART_TIMEFRAMES = ["1m", "5m", "15m", "1h", "1d"] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];
export const CHART_OVERLAYS = ["gex", "flow", "offex"] as const;
export type ChartOverlay = (typeof CHART_OVERLAYS)[number];

const INDICATOR = /^(sma|ema|bb|rsi|atr|keltner|stoch|obv|macd|vwap)(\d+)?$/;

export interface ChartQuery {
  symbol: string;
  timeframe: ChartTimeframe;
  indicators: string[];
  overlays: ChartOverlay[];
  compare: string | null;
  log: boolean;
  anchor: number | null;
}

export function indicatorPeriod(token: string, fallback: number): number {
  const match = /^[a-z]+(\d+)$/.exec(token);
  const period = match ? Number(match[1]) : fallback;
  return period > 0 ? period : fallback;
}

export function parseChartQuery(search: string): ChartQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const symbol = (params.get("s") ?? "NVDA").trim().toUpperCase();
  const tf = params.get("tf");
  const timeframe = CHART_TIMEFRAMES.includes(tf as ChartTimeframe) ? (tf as ChartTimeframe) : "1d";
  const indicators = (params.get("ind") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => INDICATOR.test(item));
  const overlays = (params.get("ov") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ChartOverlay => CHART_OVERLAYS.includes(item as ChartOverlay));
  const compareRaw = params.get("cmp")?.trim().toUpperCase() ?? "";
  const anchor = Number(params.get("av"));
  return {
    symbol: /^[A-Z][A-Z0-9.]{0,9}$/.test(symbol) ? symbol : "NVDA",
    timeframe,
    indicators: [...new Set(indicators)],
    overlays: [...new Set(overlays)],
    compare: /^[A-Z][A-Z0-9.]{0,9}$/.test(compareRaw) ? compareRaw : null,
    log: params.get("log") === "1",
    anchor: Number.isFinite(anchor) && anchor > 0 ? anchor : null,
  };
}

export function serializeChartQuery(query: ChartQuery): string {
  const params = new URLSearchParams();
  params.set("s", query.symbol);
  params.set("tf", query.timeframe);
  if (query.indicators.length) params.set("ind", query.indicators.join(","));
  if (query.overlays.length) params.set("ov", query.overlays.join(","));
  if (query.compare) params.set("cmp", query.compare);
  if (query.log) params.set("log", "1");
  if (query.anchor) params.set("av", String(query.anchor));
  return params.toString();
}
