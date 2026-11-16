import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { ModuleFrame } from "@/components/module-frame";

const ProChart = dynamic(() => import("@/components/chart/pro-chart").then((mod) => mod.ProChart), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading the chart.</p>,
});

export const metadata: Metadata = {
  title: "Chart | TradeHax",
  description: "Candles, volume, and indicators with gamma and flow overlays. Prices are delayed.",
};

export default function Page() {
  return (
    <ModuleFrame title="Chart" lede="Candles with volume, indicators, and optional gamma or flow overlays. The link is the chart: reload it and the same symbol, timeframe, and studies come back.">
      <ProChart />
    </ModuleFrame>
  );
}
