"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { assembleCurve } from "@/lib/datasets/fred";
import { datasetUrl } from "@/lib/sources/manifest";

export function MacroBoard() {
  const [body, setBody] = useState<{ meta?: { asOf?: string | null; unavailable?: boolean; error?: string }; latest?: Record<string, number | null>; note?: string } | null>(null);

  useEffect(() => {
    fetch(datasetUrl("macro.json"))
      .then((response) => (response.ok ? response.json() : null))
      .then((next) => setBody(next))
      .catch(() => setBody(null));
  }, []);

  if (body == null) return <PanelState kind="unavailable" detail="macro.json is not on this build yet. The nightly job writes FRED CSV values when the public files answer." />;
  const curve = assembleCurve(body.latest ?? {});
  return (
    <div className="flex flex-col gap-3">
      <DataBadge source="FRED public CSV" asOf={body.meta?.asOf} unavailable={body.meta?.unavailable} />
      <p className="text-sm">{body.note}</p>
      <ul className="grid gap-2 sm:grid-cols-5">
        {curve.map((point) => (
          <li key={point.tenor} className="rounded-xl bg-card/80 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">{point.tenor}</p>
            <p className="font-mono">{point.value == null ? "unavailable" : point.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
