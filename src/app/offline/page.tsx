import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Offline | TradeHax", description: "The shell is available without a network. Live quotes are not." };

export default function Page() {
  return (
    <ModuleFrame title="Offline" lede="The app shell is cached. Live quotes and the worker need a network. Cached datasets stay marked with their last as-of time.">
      <p className="text-sm text-muted-foreground">Reconnect to refresh bars, chains, and the tape.</p>
    </ModuleFrame>
  );
}
