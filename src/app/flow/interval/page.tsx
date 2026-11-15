import type { Metadata } from "next";
import { OfflinePanel } from "@/components/live/offline-panel";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Interval flow | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Interval flow" lede="Each row is one contract's volume between two snapshots: share of the day's volume, premium, and an inferred ask or bid side.">
      <OfflinePanel title="No interval buckets yet." detail="The worker stores the previous chain and emits the difference. Until it is connected, use the single delayed snapshot." delayed={{ href: "/chain/", label: "Open the chain" }} />
    </ModuleFrame>
  );
}
