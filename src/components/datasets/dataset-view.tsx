"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { datasetUrl, type DatasetMeta } from "@/lib/sources/manifest";

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
                {Object.keys(rows[0]).slice(0, 6).map((key) => (
                  <th key={key} className="px-2 py-1 text-left font-normal text-muted-foreground">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((row, index) => (
                <tr key={index} className="border-t border-border/60">
                  {Object.keys(rows[0]).slice(0, 6).map((key) => (
                    <td key={key} className="px-2 py-1 align-top">{formatCell(row[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}
