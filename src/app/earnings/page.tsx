import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { EarningsCompare } from "@/components/earnings/compare";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Earnings | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Earnings" lede="Nasdaq's calendar, the current straddle, and the last daily move. Past implied-versus-realized pairs are not invented.">
      <EarningsCompare />
      <DatasetView file="calendar" title="Earnings" />
    </ModuleFrame>
  );
}
