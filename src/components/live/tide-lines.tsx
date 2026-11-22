import { AreaChart } from "@/components/chart/series";
import { CHART_THEME } from "@/components/chart/theme";

export function TideLines({ points }: { points: { call: number; put: number; net: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-muted-foreground">Not enough prints for a line yet.</p>;
  return (
    <AreaChart
      label="Call, put, and net premium"
      series={[
        { values: points.map((point) => point.call), color: CHART_THEME.bull },
        { values: points.map((point) => point.put), color: CHART_THEME.bear },
        { values: points.map((point) => point.net), color: CHART_THEME.gold },
      ]}
    />
  );
}
