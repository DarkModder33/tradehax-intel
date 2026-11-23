import type { Metadata } from "next";
import { MapBoard } from "@/components/market/map-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Market map" };

export default function Page() {
  return (
    <ModuleFrame title="Market map" lede="Sectors sized by the absolute net premium in the worker tape and colored by its sign. Price change is not mixed in, because this view is the flow, not the cash move.">
      <MapBoard />
    </ModuleFrame>
  );
}
