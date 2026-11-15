import type { Metadata } from "next";
import { PopoutView } from "@/components/popout-view";

export const metadata: Metadata = {
  title: "TradeHax pop-out",
  description: "A compact live view of statistical signals for the symbols you pin.",
};

export default function PopoutPage() {
  return <PopoutView />;
}
