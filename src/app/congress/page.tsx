import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Congress disclosures | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Congress disclosures" lede="House periodic transaction report filings. Amounts appear when the PDF text can be read. Senate is shown as unavailable until eFD answers.">
      <DatasetView file="congress" title="Congress" />
    </ModuleFrame>
  );
}
