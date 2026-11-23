import type { Metadata } from "next";
import { AlertsBoard } from "@/components/live/alerts-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Flow signals" };

export default function Page() {
  return (
    <ModuleFrame title="Flow signals" lede="Named rules on the print stream. Repeated hits are trades in the same contract inside 100 milliseconds.">
      <AlertsBoard />
    </ModuleFrame>
  );
}
