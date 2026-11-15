import type { Metadata } from "next";
import { ScreenerView } from "@/components/datasets/screener-view";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Screener | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Screener" lede="A comparison language for saved rows, plus the most-active names from the public Yahoo list. There is no market map until a full universe file exists.">
      <ScreenerView />
    </ModuleFrame>
  );
}
