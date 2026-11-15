import type { Metadata } from "next";
import { TideBoard } from "@/components/live/tide-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Options tide | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Options tide" lede="Cumulative call and put premium for the polled names, plus a sector split and an ETF-only line. This is not the whole options market.">
      <TideBoard />
    </ModuleFrame>
  );
}
