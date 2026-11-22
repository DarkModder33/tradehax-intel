import type { Metadata } from "next";
import { RotationBoard } from "@/components/research/rotation-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Rotation | TradeHax",
  description: "Relative strength versus SPY and a correlation matrix from daily log returns.",
};

export default function Page() {
  return (
    <ModuleFrame title="Rotation" lede="Relative strength and momentum versus SPY, plus a correlation matrix. This is our own scaling around 100. It is not a branded rotation graph.">
      <RotationBoard />
    </ModuleFrame>
  );
}
