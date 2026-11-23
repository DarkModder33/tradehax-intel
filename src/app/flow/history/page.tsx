import type { Metadata } from "next";
import { HistoryBoard } from "@/components/flow/history-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Flow history" };

export default function Page() {
  return (
    <ModuleFrame title="Flow history" lede="Prints the worker still has for one day, and a next-day forward check against Yahoo closes. A quiet sample is not a strategy.">
      <HistoryBoard />
    </ModuleFrame>
  );
}
