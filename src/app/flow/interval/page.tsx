import type { Metadata } from "next";
import { IntervalBoard } from "@/components/live/interval-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Interval flow" };

export default function Page() {
  return (
    <ModuleFrame title="Interval flow" lede="Five-minute buckets of net call premium minus net put premium across the polled names.">
      <IntervalBoard />
    </ModuleFrame>
  );
}
