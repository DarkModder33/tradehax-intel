import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { StrategyBuilder } from "@/components/strategy/builder";

export const metadata: Metadata = { title: "Strategy Lab | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Strategy builder" lede="Pick legs from the delayed chain. Curves are Black-Scholes with each leg's own IV. The chance of profit is a risk-neutral model, not a forecast. Naked shorts are labelled unlimited.">
      <StrategyBuilder />
    </ModuleFrame>
  );
}
