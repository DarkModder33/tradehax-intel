"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { moveRatio, type EarningsMove } from "@/lib/datasets/earnings-moves";
import { formatDigits } from "@/lib/format";
import { datasetUrl } from "@/lib/sources/manifest";

export function EarningsMoves() {
  const [rows, setRows] = useState<EarningsMove[] | null>(null);
  const [note, setNote] = useState("Building. Implied moves appear after a nightly run stores a chain on a report date.");

  useEffect(() => {
    fetch(datasetUrl("earnings-moves.json"))
      .then((response) => (response.ok ? response.json() : { rows: [], note: "The earnings-move file is not on this build yet." }))
      .then((body: { rows?: EarningsMove[]; note?: string }) => {
        setRows(body.rows ?? []);
        if (body.note) setNote(body.note);
      })
      .catch(() => setRows([]));
  }, []);

  if (!rows) return <PanelState kind="loading" detail="Reading stored earnings moves." />;
  if (!rows.length) return <PanelState kind="empty" detail={note} />;
  const ratios = rows.map((row) => moveRatio(row.implied, row.realized)).filter((value): value is number => value != null);
  const median = ratios.length ? ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : null;
  return (
    <div className="flex flex-col gap-2">
      <DataBadge source="Cboe straddle and later close" delay="daily" />
      <p className="text-sm">Median realized/implied {median == null ? "building" : formatDigits(median, 2)}. Sample {rows.length}.</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground"><th>Symbol</th><th>Date</th><th>Timing</th><th>Implied</th><th>Realized</th><th>Ratio</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sym + row.reportDate} className="border-t border-border/60">
              <td className="py-1 font-mono">{row.sym}</td>
              <td>{row.reportDate}</td>
              <td>{row.timing}</td>
              <td>{row.implied == null ? "not stored" : `${formatDigits(row.implied * 100, 1)}%`}</td>
              <td>{row.realized == null ? "pending" : `${formatDigits(row.realized * 100, 1)}%`}</td>
              <td>{(() => { const ratio = moveRatio(row.implied, row.realized); return ratio == null ? "—" : formatDigits(ratio, 2); })()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
