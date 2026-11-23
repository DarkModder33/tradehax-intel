import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { HotBoard } from "@/components/options/hot-board";

export const metadata: Metadata = { title: "Hot Contracts" };

export default function Page() {
  return (
    <ModuleFrame title="Hot contracts" lede="A snapshot of contracts whose volume is above open interest and whose last-trade premium is at least $10,000. This is not a live tape.">
      <HotBoard />
    </ModuleFrame>
  );
}
