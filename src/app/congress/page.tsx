import type { Metadata } from "next";
import { CongressTrades } from "@/components/congress/congress-trades";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Congress stock trades tracker",
  description: "Free tracker of stock trades by members of Congress, parsed from House periodic transaction reports: ticker, amount range, trade date, member, and party.",
};

export default function Page() {
  return (
    <ModuleFrame
      title="Congress stock trades"
      lede="Every ticker trade in House periodic transaction reports from the last 120 days, parsed from the Clerk's PDFs: who traded, which side, the disclosed amount band, and when."
    >
      <CongressTrades />
    </ModuleFrame>
  );
}
