import type { Metadata } from "next";
import { StatusBoard } from "@/components/status-board";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Status",
  description: "Dataset as-of times, row counts, coverage, and the worker health check.",
};

export default function Page() {
  return (
    <ModuleFrame title="Status" lede="What the nightly job last wrote, and whether the worker is answering. A missing dataset stays unavailable. It is not filled in.">
      <StatusBoard />
    </ModuleFrame>
  );
}
