import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { EarningsCompare } from "@/components/earnings/compare";
import { EarningsMoves } from "@/components/earnings/moves";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Earnings | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Earnings" lede="Nasdaq's calendar, the current straddle, and the last daily move. Past implied-versus-realized pairs are not invented.">
      <EarningsMoves />
      <EarningsCompare />
      <DatasetView file="calendar" title="Earnings" />
    </ModuleFrame>
  );
}
