import type { Metadata } from "next";
import { PortfolioDesk } from "@/components/portfolio/desk";
import { ModuleFrame } from "@/components/module-frame";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "A local book for real holdings and simulated paper fills. Orders never leave the browser.",
};

export default function Page() {
  return (
    <ModuleFrame title="Portfolio" lede="Two books live in this browser: holdings you type or import, and paper fills simulated on delayed prices. The desk's broker keys are not used.">
      <PortfolioDesk />
    </ModuleFrame>
  );
}
