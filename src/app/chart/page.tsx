import type { Metadata } from "next";
import { ChartLoader } from "@/components/chart/chart-loader";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Chart | TradeHax",
  description: "Candles, volume, and indicators with gamma and flow overlays. Prices are delayed.",
};

export default function Page() {
  return (
    <ModuleFrame title="Chart" lede="Candles with volume, indicators, and optional gamma or flow overlays. The link is the chart: reload it and the same symbol, timeframe, and studies come back.">
      <ChartLoader />
    </ModuleFrame>
  );
}
