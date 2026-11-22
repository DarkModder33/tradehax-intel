"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { workerUrl } from "@/lib/live/worker";
import { manifestUrl, type DataManifest } from "@/lib/sources/manifest";

export function StatusBoard() {
  const [manifest, setManifest] = useState<DataManifest | null>(null);
  const [health, setHealth] = useState<string>("Worker health has not loaded.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    fetch(manifestUrl())
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`manifest ${response.status}`))))
      .then((body: DataManifest) => {
        if (!stopped) setManifest(body);
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "Manifest did not load.");
      });
    fetch(`${workerUrl()}/v1/health`)
      .then((response) => response.json())
      .then((body) => {
        if (!stopped) setHealth(`Last poll ${body.lastPoll ?? body.lastChainPoll ?? "n/a"}. Universe ${body.universeSize ?? body.symbols?.length ?? "n/a"}. ${body.message ?? ""}`);
      })
      .catch(() => {
        if (!stopped) setHealth("Worker /health did not answer.");
      });
    return () => {
      stopped = true;
    };
  }, []);

  if (error) return <PanelState kind="unavailable" detail={error} />;
  if (!manifest) return <PanelState kind="loading" detail="Reading the data manifest." />;
  const rows = Object.entries(manifest.datasets ?? {});
  return (
    <div className="flex flex-col gap-3">
      <DataBadge source="data/manifest.json" asOf={manifest.generatedAt} />
      <p className="text-sm">{health}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="p-2">Dataset</th>
              <th className="p-2">As of</th>
              <th className="p-2">Rows</th>
              <th className="p-2">Coverage</th>
              <th className="p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, meta]) => (
              <tr key={name} className="border-t border-border/60">
                <td className="p-2 font-mono">{name}</td>
                <td className="p-2">{meta.asOf ?? "n/a"}</td>
                <td className="p-2">{meta.rows}</td>
                <td className="p-2">{meta.coverage == null ? "n/a" : `${Math.round(meta.coverage * 100)}%`}</td>
                <td className="p-2">{meta.unavailable ? meta.error ?? "unavailable" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
