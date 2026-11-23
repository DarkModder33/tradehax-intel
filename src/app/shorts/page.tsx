import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { ShortsBoard } from "@/components/options/shorts-board";

export const metadata: Metadata = { title: "Short volume" };

export default function Page() {
  return (
    <ModuleFrame title="Short volume" lede="FINRA's daily short-volume file, which is the off-exchange and on-exchange volume FINRA reports. Short interest and borrow are separate and are not in this file.">
      <ShortsBoard />
    </ModuleFrame>
  );
}
