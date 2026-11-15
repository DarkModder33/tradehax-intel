import type { Metadata } from "next";
import { OfflinePanel } from "@/components/live/offline-panel";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Flow signals | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Flow signals" lede="Repeated hits, sweeps followed by floor, and the interval-unusual check. They run on the worker's print stream.">
      <OfflinePanel title="No rules are evaluating in the browser." detail="Without the worker, there is no print stream to group. The hot-contract snapshot is the delayed stand-in." delayed={{ href: "/flow/hot/", label: "Hot contracts" }} />
    </ModuleFrame>
  );
}
