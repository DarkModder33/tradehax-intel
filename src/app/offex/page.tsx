import type { Metadata } from "next";
import { OffexBoard } from "@/components/live/offex-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Off-exchange prints | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Off-exchange prints" lede="Stock prints reported to a FINRA TRF. Exchange D on an option is a real options exchange and is not shown here.">
      <OffexBoard />
    </ModuleFrame>
  );
}
