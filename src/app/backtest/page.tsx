import type { Metadata } from "next";
import { BacktestLab } from "@/components/backtest/lab";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Backtest",
  description: "Replay a rule on daily bars. Fills are the next open. The deflated Sharpe counts every run this session.",
};

export default function Page() {
  return (
    <ModuleFrame title="Backtest lab" lede="Rules fill at the next bar's open. The deflated Sharpe counts every parameter set tried in this session, and a sample under 30 trades is labelled as thin.">
      <BacktestLab />
    </ModuleFrame>
  );
}
