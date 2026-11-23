import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { TickerOverview } from "@/components/ticker/overview";

export const metadata: Metadata = { title: "Ticker" };

export default function Page() {
  return (
    <ModuleFrame title="Ticker" lede="One name across price, the daily vote, delayed gamma, worker flow, and the latest filings. Open it as /t/?s=NVDA or /t/#NVDA. A path per symbol is not possible on a static export.">
      <TickerOverview />
    </ModuleFrame>
  );
}
