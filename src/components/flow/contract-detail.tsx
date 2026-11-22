"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { LineChart } from "@/components/chart/series";
import { formatOcc } from "@/lib/format";
import { workerUrl } from "@/lib/live/worker";
import { parseOcc } from "@/lib/sources/occ";
import { scoreDeciles } from "@/lib/flow/score";

export function ContractDetail() {
  const [occ, setOcc] = useState(() => {
    if (typeof window === "undefined") return "NVDA261218C00200000";
    return new URLSearchParams(window.location.search).get("occ")?.toUpperCase() || "NVDA261218C00200000";
  });
  const [prints, setPrints] = useState<{ time: string; premium: number; side: string; score?: number; scoreStatus?: string }[]>([]);
  const [barsNote, setBarsNote] = useState("Option bars have not been requested.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseOcc(occ);
    if (!parsed) return;
    let stopped = false;
    fetch(`${workerUrl()}/v1/flow?symbol=${parsed.root}&limit=200`)
      .then((response) => response.json())
      .then((body) => {
        if (stopped) return;
        const mine = (body.prints ?? []).filter((print: { contract: string }) => print.contract === occ);
        setPrints(mine);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "Flow did not load.");
      });
    fetch(`${workerUrl()}/v1/optbars/${occ}`)
      .then(async (response) => {
        if (!response.ok) {
          if (!stopped) setBarsNote(response.status === 503 ? "Option bars need Alpaca on the worker. Unavailable, not estimated." : `Option bars returned ${response.status}.`);
          return;
        }
        const body = await response.json();
        const list = body.body?.bars?.[occ] ?? body.bars?.[occ] ?? [];
        if (!stopped) setBarsNote(Array.isArray(list) && list.length ? `${list.length} delayed bars.` : "Alpaca returned no bars for this contract.");
      })
      .catch(() => {
        if (!stopped) setBarsNote("Option bars did not load.");
      });
    return () => {
      stopped = true;
    };
  }, [occ]);

  const parsed = parseOcc(occ);
  const deciles = scoreDeciles(prints.filter((print) => print.score != null).map((print) => ({ score: print.score ?? 0, forward: 0 })));
  return (
    <div className="flex flex-col gap-3">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setOcc(String(data.get("occ") ?? "").toUpperCase()); }}>
        <input name="occ" defaultValue={occ} aria-label="OCC symbol" className="h-10 w-72 rounded-md border border-border bg-card px-2 font-mono text-sm" />
        <button type="submit" className="h-10 rounded-full px-3 text-xs">Load</button>
      </form>
      <DataBadge source="worker flow" delay="about 15 min" />
      <h2 className="font-mono text-xl">{parsed ? formatOcc(occ) : "Not a standard OCC symbol"}</h2>
      {error ? <PanelState kind="error" detail={error} /> : null}
      <p className="text-sm">{barsNote}</p>
      <LineChart values={prints.map((print) => print.premium)} label="Print premiums" className="h-24 w-full" />
      <p className="text-xs text-muted-foreground">Decile backtest sample size {prints.length}. A next-day move table stays flat until stored history has a following close. {deciles.length ? `Deciles ${deciles.map((row) => `${row.decile}:${row.n}`).join(" ")}` : "Building: not enough scored prints."}</p>
      <ul className="text-sm">
        {prints.slice(0, 12).map((print) => (
          <li key={print.time + print.premium}>{print.time} {print.side} ${Math.round(print.premium)} score {print.score ?? "n/a"} {print.scoreStatus === "building" ? "(building)" : ""}</li>
        ))}
      </ul>
    </div>
  );
}
