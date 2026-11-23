import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { ChainBoard } from "@/components/options/chain-board";

export const metadata: Metadata = { title: "Chain" };

export default function Page() {
  return (
    <ModuleFrame title="Chain" lede="Calls on the left, puts on the right. Shaded rows are in the money. Open a contract for the delayed quote and greeks.">
      <ChainBoard />
    </ModuleFrame>
  );
}
