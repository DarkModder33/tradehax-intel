"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { datasetUrl, type DatasetMeta } from "@/lib/sources/manifest";
import { LAYOUTS, genericLayout } from "./columns";

export function DatasetView({ file, title }: { file: string; title: string }) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    fetch(datasetUrl(`${file}.json`), { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`${title} has not been published.`);
        return response.json();
      })
      .then((body) => {
        if (!stopped) setPayload(body);
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "Unavailable");
      });
    return () => {
      stopped = true;
    };
  }, [file, title]);

  const meta = (payload?.meta ?? null) as DatasetMeta | null;
  const rows = Array.isArray(payload?.rows) ? (payload.rows as Record<string, unknown>[]) : [];
  const layout = LAYOUTS[file] ?? genericLayout(rows);
  const sortKey = layout.sortKey;
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const left = sortKey(a);
        const right = sortKey(b);
        const order = left < right ? -1 : left > right ? 1 : 0;
        return layout.ascending ? order : -order;
      })
    : rows;

  return (
    <div className="flex flex-col gap-3">
      {meta ? (
        <DataBadge source={meta.source} asOf={meta.asOf} delay={meta.delay} unavailable={meta.unavailable} stale={meta.stale} />
      ) : (
        <p className="text-sm text-muted-foreground">{error ?? "Loading the precomputed file."}</p>
      )}
      {meta?.error ? <p className="text-sm text-muted-foreground">{meta.error}</p> : null}
      {typeof payload?.note === "string" && payload.note ? <p className="text-sm text-muted-foreground">{payload.note}</p> : null}
      {payload?.senate && typeof payload.senate === "object" ? (
        <p className="text-sm text-muted-foreground">Senate: {String((payload.senate as { error?: string }).error ?? "unavailable")}</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {layout.columns.map((column) => (
                  <th key={column.label} scope="col" className={`px-2 py-1 font-normal text-muted-foreground ${column.numeric ? "text-right" : "text-left"}`}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map((row, index) => (
                <tr key={index} className="border-t border-border/60">
                  {layout.columns.map((column) => {
                    const href = column.href?.(row) ?? null;
                    const value = column.value(row);
                    return (
                      <td key={column.label} className={`px-2 py-1 align-top ${column.numeric ? "text-right font-mono tabular-nums" : ""}`}>
                        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{value}</a> : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length > 50 ? <p className="mt-2 text-xs text-muted-foreground">Showing 50 of {sorted.length.toLocaleString("en-US")} rows.</p> : null}
        </div>
      ) : meta && !meta.unavailable ? (
        <p className="text-sm text-muted-foreground">No rows in the latest file.</p>
      ) : null}
    </div>
  );
}
