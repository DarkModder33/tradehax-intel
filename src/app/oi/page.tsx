import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "OI change" };

export default function Page() {
  return (
    <ModuleFrame title="OI change" lede="Open interest changes once each morning. Until a prior chain is stored, there is nothing to diff.">
      <DatasetView file="oi-change" title="OI change" />
    </ModuleFrame>
  );
}
