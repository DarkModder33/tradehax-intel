import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "ETF flows | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="ETF flows" lede="Flows are the change in shares outstanding times NAV. The SPDR workbook is not expanded here, so the series is unavailable.">
      <DatasetView file="etf-flows" title="ETF flows" />
    </ModuleFrame>
  );
}
