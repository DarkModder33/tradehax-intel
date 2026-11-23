import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { GexBoard } from "@/components/options/gex-board";

export const metadata: Metadata = { title: "Dealer Gamma Map" };

export default function Page() {
  return (
    <ModuleFrame title="Dealer Gamma Map" lede="Open-interest gamma, delta, vanna, and charm from the delayed chain. Walls are the largest call gamma above the spot and the largest put gamma below it.">
      <GexBoard />
    </ModuleFrame>
  );
}
