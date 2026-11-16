import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "About | TradeHax",
  description: "What TradeHax shows, where the data comes from, and the charting credit.",
};

export default function Page() {
  return (
    <ModuleFrame title="About" lede="TradeHax is a research desk. Nothing here is a recommendation to buy or sell.">
      <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Quotes and candles prefer the TradeHax worker. When that route is quiet, the page falls back to Yahoo Finance through a keyless proxy. Option chains are Cboe delayed quotes. Flow prints are about 15 minutes delayed when Alpaca is connected, and inferred from chain diffs when it is not.</p>
        <p>Charts use TradingView Lightweight Charts, which is licensed under Apache-2.0. The TradingView logo on the chart is part of that license. TradeHax is not affiliated with TradingView.</p>
      </div>
    </ModuleFrame>
  );
}