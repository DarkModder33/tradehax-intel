"use client";

import { useState } from "react";
import { DatasetView } from "@/components/datasets/dataset-view";
import { matchQuery } from "@/lib/datasets/query";

const PREVIEW = [
  { symbol: "NVDA", iv_rank: 88, sector: "Technology", net_call_premium: 2_000_000 },
  { symbol: "XOM", iv_rank: 40, sector: "Energy", net_call_premium: 100_000 },
];

export function ScreenerView() {
  const [query, setQuery] = useState('iv_rank > 80 AND sector = "Technology"');
  let error: string | null = null;
  let matches: typeof PREVIEW = [];
  try {
    matches = PREVIEW.filter((row) => matchQuery(row, query));
  } catch (err) {
    error = err instanceof Error ? err.message : "The query could not be read.";
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="text-sm">
        Query
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 block h-8 w-full max-w-xl rounded-md border border-border bg-card px-2 font-mono text-xs" />
      </label>
      {error ? <p className="text-sm text-bearish">{error}</p> : null}
      <p className="text-sm text-muted-foreground">The box below is a local example of the filter. It is not the live universe. The table under it is the precomputed most-active list.</p>
      <ul className="text-sm">
        {matches.map((row) => (
          <li key={row.symbol}>{row.symbol} · {row.sector} · IV rank {row.iv_rank}</li>
        ))}
        {matches.length === 0 && !error ? <li>No example rows match.</li> : null}
      </ul>
      <DatasetView file="screener" title="Screener" />
    </div>
  );
}
