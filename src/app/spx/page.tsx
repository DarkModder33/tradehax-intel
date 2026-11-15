import type { Metadata } from "next";
import { SymbolFlow } from "@/components/live/symbol-flow";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Net flow | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Net flow and NOPE" lede="Per-ticker net call and put premium, plus NOPE from the worker. This is not Cboe open/close dealer positioning. SPX is not polled.">
      <SymbolFlow initial="SPY" title="Net flow" />
    </ModuleFrame>
  );
}
