import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Seasonality" };

export default function Page() {
  return (
    <ModuleFrame title="Seasonality" lede="SPY month-of-year returns from monthly closes. A positive month in the past is not a forecast.">
      <DatasetView file="seasonality" title="Seasonality" />
    </ModuleFrame>
  );
}
