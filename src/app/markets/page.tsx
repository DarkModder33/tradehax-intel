import type { Metadata } from "next";
import { WhaleBoard } from "@/components/markets/whales";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Markets | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Other markets" lede="Polymarket's open markets and a Bitcoin fee snapshot. This is not a labeled whale-transfer feed.">
      <WhaleBoard />
    </ModuleFrame>
  );
}
