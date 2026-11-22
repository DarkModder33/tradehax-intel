import type { Metadata } from "next";
import { ContractDetail } from "@/components/flow/contract-detail";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Contract | TradeHax",
  description: "One option contract: prints, a score, and delayed bars when the worker has them.",
};

export default function Page() {
  return (
    <ModuleFrame title="Contract" lede="Open /c/?occ=NVDA261218C00200000. The score needs about 20 prints before the median is treated as history. Until then it is marked building.">
      <ContractDetail />
    </ModuleFrame>
  );
}
