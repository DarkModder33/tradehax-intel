import type { Metadata } from "next";
import Link from "next/link";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = { title: "Alerts" };

export default function Page() {
  return (
    <ModuleFrame title="Alerts" lede="The alert feed is being built. Browser alert rules live on the rules page.">
      <Link href="/alerts/rules/" className="text-sm text-gold hover:underline">Alert rules</Link>
    </ModuleFrame>
  );
}
