import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = { title: "Signal desk" };

export default function Page() {
  return <Dashboard />;
}
