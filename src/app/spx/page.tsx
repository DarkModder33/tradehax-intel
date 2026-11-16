import type { Metadata } from "next";
import { SymbolFlow } from "@/components/live/symbol-flow";
import { GexBoard } from "@/components/options/gex-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "SPX | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="SPX gamma and net flow" lede="Index gamma comes from the worker chain summary, so the 13 MB Cboe file stays on the server. Net flow below is the equity tape, not Cboe open/close dealer positioning.">
      <GexBoard initial="_SPX" />
      <SymbolFlow initial="SPY" title="Equity net flow" />
    </ModuleFrame>
  );
}
