import type { Metadata } from "next";
import { OfflinePanel } from "@/components/live/offline-panel";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "SPX estimate | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="SPX estimate" lede="This is not Cboe open/close data. It would be dealer exposure estimated from volume diffs on SPX and SPXW. The full chain is too large for the browser proxy.">
      <OfflinePanel title="Estimated dealer exposure is not connected." detail="The worker would slim the chain to strikes within 15 percent of spot. Until then this page stays empty." delayed={{ href: "/gex/?s=SPY", label: "SPY open-interest gamma" }} />
    </ModuleFrame>
  );
}
