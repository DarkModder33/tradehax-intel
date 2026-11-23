import type { Metadata } from "next";
import { DatasetView } from "@/components/datasets/dataset-view";
import { EarningsMoves } from "@/components/earnings/moves";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Earnings implied vs actual move history",
  description: "Free earnings move tracker: the options-implied move before each report against what the stock actually did, plus upcoming reports priced against their usual move.",
};

export default function Page() {
  return (
    <ModuleFrame
      title="Earnings moves: implied vs actual"
      lede="What options priced before each report, what the stock actually did, and whether the next report is priced rich or cheap against its own history."
    >
      <EarningsMoves />
      <section>
        <h2 className="mb-2 text-base font-semibold">Earnings calendar</h2>
        <DatasetView file="calendar" title="Earnings" />
      </section>
    </ModuleFrame>
  );
}
