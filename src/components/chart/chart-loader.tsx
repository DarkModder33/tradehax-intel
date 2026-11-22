"use client";

import dynamic from "next/dynamic";

const ProChart = dynamic(() => import("@/components/chart/pro-chart").then((mod) => mod.ProChart), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading the chart.</p>,
});

export function ChartLoader() {
  return <ProChart />;
}
