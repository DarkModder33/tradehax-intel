"use client";

import { useCallback, useState } from "react";
import { parseChartQuery, serializeChartQuery, type ChartQuery } from "@/lib/chart/url-state";

export function useChartState(): { query: ChartQuery; replace: (next: ChartQuery) => void } {
  const [query, setQuery] = useState<ChartQuery>(() => parseChartQuery(window.location.search));
  const replace = useCallback((next: ChartQuery) => {
    const search = serializeChartQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
    setQuery(next);
  }, []);
  return { query, replace };
}
