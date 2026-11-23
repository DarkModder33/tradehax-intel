import type { Metadata } from "next";
import { ModuleFrame } from "@/components/module-frame";
import { SCORE_WEIGHTS } from "@/lib/flow/score";

export const metadata: Metadata = {
  title: "Methodology | TradeHax",
  description: "How the unusual-activity score is weighted. It is a description, not a forecast.",
};

export default function Page() {
  return (
    <ModuleFrame title="Methodology" lede="The unusual score is a weighted mix of clipped factors. It is not a probability of profit.">
      <ul className="text-sm">
        {Object.entries(SCORE_WEIGHTS).map(([name, weight]) => (
          <li key={name}>{name}: {Math.round(weight * 100)}%</li>
        ))}
      </ul>
      <p className="max-w-3xl text-sm text-muted-foreground">Until a ticker has 20 stored prints, the median premium is thin and the score is marked building. The decile table shows the sample size even when the next-day edge is flat.</p>
      <p className="max-w-3xl text-sm text-muted-foreground">News pages are written from stored files when a number clears a fixed threshold. Each story names the source and the timestamp. An empty file does not become an article. The line on the page says the note is auto-generated and is not investment advice.</p>
    </ModuleFrame>
  );
}
