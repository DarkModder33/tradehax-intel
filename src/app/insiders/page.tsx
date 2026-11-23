import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Insiders" };

export default function Page() {
  return (
    <ModuleFrame title="Insiders" lede="Form 4 filings from EDGAR. A row without a parsed trade is an index hit whose XML did not come back.">
      <DatasetView file="insiders" title="Insiders" />
    </ModuleFrame>
  );
}
