import type { Metadata } from "next";
import { LabNotebook } from "@/components/lab/notebook";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Python lab | TradeHax",
  description: "An in-browser notebook. Python loads only after you start it, about 10 MB from the public CDN.",
};

export default function Page() {
  return (
    <ModuleFrame title="Python lab" lede="Pyodide stays unloaded until you press Start. The helper module fetches bars through the page. Nothing is installed on a server.">
      <LabNotebook />
    </ModuleFrame>
  );
}
