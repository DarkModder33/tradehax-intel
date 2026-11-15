import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { VolBoard } from "@/components/options/vol-board";

export const metadata: Metadata = { title: "Volatility Lab | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Volatility Lab" lede="Term structure, 25-delta skew, the smile, and a moneyness surface from the delayed chain. IV rank waits until the nightly history has a year of days.">
      <VolBoard />
    </ModuleFrame>
  );
}
