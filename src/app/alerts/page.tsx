import type { Metadata } from "next";
import { AlertDesk } from "@/components/alerts/desk";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Alerts | TradeHax" };

export default function Page() {
  return (
    <ModuleFrame title="Watchlists and alerts" lede="Lists and rules stay in this browser. Matches are checked against the worker stream. Web push is not wired: there is no VAPID key in this build, so notifications stay in the tab.">
      <AlertDesk />
    </ModuleFrame>
  );
}
