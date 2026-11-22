import type { Metadata } from "next";
import { MacroBoard } from "@/components/research/macro-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Macro | TradeHax",
  description: "Treasury yields, spreads, and volatility from public FRED and Cboe files when they are present.",
};

export default function Page() {
  return (
    <ModuleFrame title="Macro" lede="Yields and spreads from the nightly FRED file. A series that did not download is marked unavailable. It is not filled in.">
      <MacroBoard />
    </ModuleFrame>
  );
}
