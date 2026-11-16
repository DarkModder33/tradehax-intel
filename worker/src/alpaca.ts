import { alpacaSymbol } from "../../src/lib/market/alpaca-bars.ts";

/** URL builders only. The worker does not call Alpaca unless ALPACA_KEY_ID is set, and this file is not imported by the static site. */

export function optionTradesUrl(symbols: string[], start: string, end: string): string {
  const params = new URLSearchParams({ symbols: symbols.join(","), start, end });
  return `https://data.alpaca.markets/v1beta1/options/trades?${params}`;
}

export function stockTradesUrl(symbols: string[], start: string, end: string): string {
  const params = new URLSearchParams({ symbols: symbols.map(alpacaSymbol).join(","), start, end, feed: "sip" });
  return `https://data.alpaca.markets/v2/stocks/trades?${params}`;
}

export function alpacaConfigured(): boolean {
  return Boolean(process.env.ALPACA_KEY_ID && process.env.ALPACA_SECRET);
}

export function alpacaHeaders(): Record<string, string> {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_KEY_ID ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET ?? "",
  };
}
