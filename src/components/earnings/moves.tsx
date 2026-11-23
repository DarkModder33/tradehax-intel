"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import type { EarningsRow, UpcomingRow } from "@/lib/datasets/earnings-history";
import { formatDigits, formatSignedPercent } from "@/lib/format";
import { datasetUrl, type DatasetMeta } from "@/lib/sources/manifest";
import { tickerPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

interface EarningsFile {
  meta?: DatasetMeta & { note?: string };
  note?: string;
  rows?: EarningsRow[];
  upcoming?: UpcomingRow[];
}

const pct = (value: number | null | undefined, digits = 1) => (value == null || !Number.isFinite(value) ? "—" : `${formatDigits(Math.abs(value) * 100, digits)}%`);
const signed = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : formatSignedPercent(value, 1));

function MoveBar({ implied, realized }: { implied: number | null; realized: number }) {
  const scale = Math.max(Math.abs(realized), implied ?? 0, 0.0001) * 1.15;
  return (
    <span className="relative block h-2.5 w-28 rounded-full bg-white/[0.06]" aria-hidden="true">
      {implied != null ? <span className="absolute inset-y-0 left-0 rounded-full border border-gold/60 bg-gold/15" style={{ width: `${(implied / scale) * 100}%` }} /> : null}
      <span className={cn("absolute top-[3px] left-0 h-1 rounded-full", realized >= 0 ? "bg-bullish" : "bg-bearish")} style={{ width: `${(Math.abs(realized) / scale) * 100}%` }} />
    </span>
  );
}

export function EarningsMoves() {
  const [file, setFile] = useState<EarningsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("s");
    const timer = initial ? window.setTimeout(() => setQuery(initial.toUpperCase()), 0) : undefined;
    fetch(datasetUrl("earnings-moves.json"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`earnings-moves.json ${response.status}`))))
      .then((body: EarningsFile) => setFile(body))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "earnings-moves.json did not load"));
    return () => window.clearTimeout(timer);
  }, []);

  const rows = useMemo(() => (file?.rows ?? []).filter((row) => row && Number.isFinite(row.realized)), [file]);
  const shown = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return needle ? rows.filter((row) => row.sym === needle) : rows;
  }, [rows, query]);
  const stats = useMemo(() => {
    const paired = shown.filter((row) => row.implied != null && row.implied > 0);
    const over = paired.filter((row) => Math.abs(row.realized) > (row.implied ?? 0));
    const ratios = paired.map((row) => Math.abs(row.realized) / (row.implied ?? 1)).sort((a, b) => a - b);
    return {
      reports: shown.length,
      paired: paired.length,
      overShare: paired.length ? over.length / paired.length : null,
      median: ratios.length ? ratios[Math.floor(ratios.length / 2)] : null,
      avgMove: shown.length ? shown.reduce((sum, row) => sum + Math.abs(row.realized), 0) / shown.length : null,
    };
  }, [shown]);
  const upcoming = (file?.upcoming ?? []).filter((row) => !query.trim() || row.sym === query.trim().toUpperCase());

  if (error) return <PanelState kind="unavailable" detail={error} />;
  if (!file) return <PanelState kind="loading" detail="Reading the earnings move history." />;
  if (rows.length === 0) return <PanelState kind="empty" detail={file.note ?? file.meta?.note ?? "No earnings moves stored yet."} />;

  return (
    <div className="flex flex-col gap-6">
      {file.meta ? <DataBadge source={file.meta.source} asOf={file.meta.asOf} delay={file.meta.delay} stale={file.meta.stale} /> : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: query ? `${query.toUpperCase()} reports` : "Reports on file", value: String(stats.reports) },
          { label: "Moved more than implied", value: stats.overShare == null ? "—" : `${Math.round(stats.overShare * 100)}%` },
          { label: "Median actual ÷ implied", value: stats.median == null ? "—" : `${formatDigits(stats.median, 2)}x` },
          { label: "Average actual move", value: pct(stats.avgMove) },
        ].map((card) => (
          <div key={card.label} className="surface px-4 py-3">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-mono text-xl tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {upcoming.length > 0 ? (
        <section>
          <h2 className="mb-1 text-base font-semibold">Upcoming: implied now vs the usual move</h2>
          <p className="mb-2 text-xs text-muted-foreground">Implied is today&apos;s at-the-money straddle for the first expiry after the report, shown within 14 days of the date. Usual is the average absolute move over the last four reports.</p>
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[600px] whitespace-nowrap text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left">Ticker</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Reports</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Implied now</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Usual move</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Read</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((row) => {
                  const ratio = row.implied != null && row.avgMove ? row.implied / row.avgMove : null;
                  return (
                    <tr key={`${row.sym}-${row.reportDate}`} className="border-t border-white/[0.05]">
                      <td className="px-3 py-2"><button type="button" className="font-mono font-semibold text-gold hover:underline" onClick={() => setQuery(row.sym)}>{row.sym}</button></td>
                      <td className="px-3 py-2 font-mono">{row.reportDate}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.implied == null ? <span className="text-muted-foreground">priced 14d out</span> : `±${pct(row.implied)}`}</td>
                      <td className="px-3 py-2 text-right font-mono">{pct(row.avgMove)}</td>
                      <td className="px-3 py-2 text-xs">
                        {ratio == null ? <span className="text-muted-foreground">—</span> : ratio > 1.15 ? <span className="text-gold">Options price a bigger move than usual</span> : ratio < 0.85 ? <span className="text-bullish">Options price a smaller move than usual</span> : <span className="text-muted-foreground">In line with history</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">History: implied vs actual</h2>
            <p className="text-xs text-muted-foreground">Gold outline is the implied move. The bar inside is what the stock did, green up and red down.</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker" aria-label="Filter by ticker" className="h-10 w-32 rounded-full border border-white/10 bg-white/[0.03] px-4 font-mono text-sm uppercase" />
            {query ? <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setQuery("")}>All</button> : null}
          </div>
        </div>
        {shown.length === 0 ? (
          <PanelState kind="empty" detail="No stored reports for that ticker." />
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[760px] whitespace-nowrap text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left">Report</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Ticker</th>
                  <th scope="col" className="px-3 py-2.5 text-right">EPS surprise</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Implied</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Actual</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Implied vs actual</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Actual ÷ implied</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 200).map((row) => {
                  const ratio = row.implied ? Math.abs(row.realized) / row.implied : null;
                  return (
                    <tr key={`${row.sym}-${row.reportDate}`} className="border-t border-white/[0.05]">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.reportDate}<span className="block text-[10px] text-muted-foreground">{row.fiscalQuarter ?? ""}</span></td>
                      <td className="px-3 py-2"><Link href={tickerPath(row.sym)} className="font-mono font-semibold text-gold hover:underline">{row.sym}</Link></td>
                      <td className={cn("px-3 py-2 text-right font-mono", (row.surprisePct ?? 0) > 0 ? "text-bullish" : (row.surprisePct ?? 0) < 0 ? "text-bearish" : "")}>{row.surprisePct == null ? "—" : `${row.surprisePct > 0 ? "+" : ""}${row.surprisePct}%`}</td>
                      <td className="px-3 py-2 text-right font-mono" title={row.impliedSource ?? "Not captured"}>{row.implied == null ? <span className="text-muted-foreground">not captured</span> : `±${pct(row.implied)}`}</td>
                      <td className={cn("px-3 py-2 text-right font-mono", row.realized >= 0 ? "text-bullish" : "text-bearish")} title={`${row.beforeDate} close ${row.closeBefore} → ${row.afterDate} close ${row.closeAfter}`}>{signed(row.realized)}</td>
                      <td className="px-3 py-2"><MoveBar implied={row.implied} realized={row.realized} /></td>
                      <td className={cn("px-3 py-2 text-right font-mono", ratio != null && ratio > 1 ? "text-gold" : "text-muted-foreground")}>{ratio == null ? "—" : `${formatDigits(ratio, 2)}x`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {file.meta?.note ?? file.note} Implied is the at-the-money straddle for the first expiry after the report, priced on the close before it, divided by spot. Report dates and EPS surprise come from Nasdaq; closes from Alpaca SIP daily bars.
      </p>
    </div>
  );
}
