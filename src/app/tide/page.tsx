import type { Metadata } from "next";
import { OfflinePanel } from "@/components/live/offline-panel";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Options tide | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Options tide" lede="Cumulative call-ask premium minus call-bid premium, and the same for puts. Mid prints, premiums under $1,000, and deep in-the-money contracts are left out.">
      <OfflinePanel title="Market, sector, ETF, and 0DTE views need the worker." detail="The tide is a sum across the polled universe, about 15 minutes delayed. It is not the whole market." delayed={{ href: "/gex/", label: "Open-interest gamma for one symbol" }} />
    </ModuleFrame>
  );
}
