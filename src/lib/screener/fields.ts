export const SCREENER_FIELDS = [
  "symbol",
  "name",
  "sector",
  "industry",
  "mcap",
  "price",
  "change",
  "volume",
  "rsi14",
  "sma50",
  "sma200",
  "pctFrom52wHigh",
  "atrPct",
  "rvol20",
  "ret5d",
  "ret1m",
  "ret3m",
  "iv30",
  "ivr",
  "vrp",
  "si_pct_float",
  "dtc",
  "offex",
  "earnings",
  "net_premium",
] as const;

export type ScreenerField = (typeof SCREENER_FIELDS)[number];

export const PRESET_SCREENS: { name: string; query: string }[] = [
  { name: "Oversold large caps", query: "rsi14 < 30 AND mcap > 10000000000" },
  { name: "High IV rank", query: "ivr > 70" },
  { name: "Squeeze watch", query: "si_pct_float > 15 AND dtc > 5" },
  { name: "52-week high breakouts", query: "pctFrom52wHigh > -0.01 AND mcap > 300000000" },
  { name: "Earnings this week + rich IV", query: "earnings = soon AND ivr > 50" },
  { name: "Heavy call flow", query: "net_premium > 1000000" },
];

export function suggestFields(prefix: string): string[] {
  const needle = prefix.trim().toLowerCase();
  return SCREENER_FIELDS.filter((field) => field.toLowerCase().startsWith(needle));
}
