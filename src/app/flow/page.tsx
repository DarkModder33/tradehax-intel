import type { Metadata } from "next";
import { OfflinePanel } from "@/components/live/offline-panel";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Flow tape | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Flow tape" lede="Inferred prints are the change in delayed volume between two chain snapshots. A single order is not visible. Ask, bid, and mid are estimated from the snapshot quote.">
      <OfflinePanel
        title="Interval prints"
        detail="When the worker is running it diffs Cboe chains about every minute for the top names and emits a row when volume increases. Alpaca's 15-minute option trades, if a key is added on the server, replace the aggregate row with individual prints and can mark sweeps."
        delayed={{ href: "/flow/hot/", label: "Delayed unusual snapshot" }}
      />
    </ModuleFrame>
  );
}
