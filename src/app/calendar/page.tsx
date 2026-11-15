import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Calendar | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Calendar" lede="Economic events and earnings from Nasdaq. FOMC dates are not bundled, so that list stays unavailable.">
      <DatasetView file="calendar" title="Calendar" />
    </ModuleFrame>
  );
}
