import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { StrategyBoard } from "@/components/options/strategy-board";

export const metadata: Metadata = { title: "Strategy Lab | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Strategy Lab" lede="Payoff at expiration for a few listed structures. Premiums are per share. The chance of profit is a zero-rate lognormal over 30 days, not a forecast.">
      <StrategyBoard />
    </ModuleFrame>
  );
}
