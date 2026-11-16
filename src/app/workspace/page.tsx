import type { Metadata } from "next";
import { WorkspaceBoard } from "@/components/workspace/board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Workspace | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Workspace" lede="A saved layout of panels. Wide doubles a cell. Pop out opens the compact tape window, which is the existing Picture-in-Picture path.">
      <WorkspaceBoard />
    </ModuleFrame>
  );
}
