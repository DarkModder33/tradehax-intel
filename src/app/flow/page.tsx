import type { Metadata } from "next";
import { FlowTape } from "@/components/live/flow-tape";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Flow tape" };

export default function Page() {
  return (
    <ModuleFrame title="Flow tape" lede="Individual option prints from the worker, about 15 minutes delayed. Ask, bid, and mid are estimated from the Cboe quote at the snapshot, not from a full NBBO history.">
      <FlowTape />
    </ModuleFrame>
  );
}
