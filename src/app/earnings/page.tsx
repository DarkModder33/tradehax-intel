import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Earnings | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Earnings" lede="The Nasdaq earnings calendar when it answers. The straddle expected move for a name you type lives on the volatility page.">
      <DatasetView file="calendar" title="Earnings" />
    </ModuleFrame>
  );
}
