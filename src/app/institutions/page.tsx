import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Institutions | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Institutions" lede="13F holdings. The quarterly ZIP is not expanded in this snapshot, so the panel stays empty instead of inventing holders.">
      <DatasetView file="institutions" title="Institutions" />
    </ModuleFrame>
  );
}
