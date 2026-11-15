import type { Metadata } from "next";
import { OfflinePanel } from "@/components/live/offline-panel";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Off-exchange prints | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Off-exchange prints" lede="Prints with exchange D are FINRA TRF or ADF reports. They include ATS and internalized retail flow. They are not a pure dark-pool tape.">
      <OfflinePanel title="15-minute prints are not connected." detail="Daily FINRA-reported volume, including the short-volume file, is available without the worker. Price levels and individual prints wait for Alpaca SIP trades older than 15 minutes." delayed={{ href: "/shorts/", label: "FINRA short and total volume" }} />
    </ModuleFrame>
  );
}
