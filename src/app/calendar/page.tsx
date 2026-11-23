import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { FomcList } from "@/components/market/fomc-list";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <ModuleFrame title="Calendar" lede="Nasdaq earnings and economic events when they answer, the published FOMC dates through 2027, and the IPO calendar when Nasdaq returns rows.">
      <FomcList />
      <DatasetView file="calendar" title="Calendar" />
    </ModuleFrame>
  );
}
