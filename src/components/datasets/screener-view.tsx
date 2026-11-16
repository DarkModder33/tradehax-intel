"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { VirtualTable } from "@/components/ui/virtual-table";
import { matchQuery, parseQuery } from "@/lib/datasets/query";
import { datasetUrl } from "@/lib/sources/manifest";
import { PRESET_SCREENS, SCREENER_FIELDS, suggestFields } from "@/lib/screener/fields";
import { joinRows, toCsv, type ScreenerRow } from "@/lib/screener/join";
import { tickerPath } from "@/lib/ticker/route";

const DEFAULT_COLUMNS = ["symbol", "name", "sector", "mcap", "price", "change", "rsi14", "ivr"];

function readInitial(): { query: string; columns: string[] } {
  if (typeof window === "undefined") return { query: "mcap > 10000000000", columns: DEFAULT_COLUMNS };
  const params = new URLSearchParams(window.location.search);
  const columns = (params.get("cols") ?? "").split(",").filter((column) => (SCREENER_FIELDS as readonly string[]).includes(column));
  return { query: params.get("q") ?? "mcap > 10000000000", columns: columns.length ? columns : DEFAULT_COLUMNS };
}

export function ScreenerView() {
  const initial = readInitial();
  const [query, setQuery] = useState(initial.query);
  const [columns, setColumns] = useState(initial.columns);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [sources, setSources] = useState<{ source: string; asOf: string | null; unavailable?: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const files = ["universe.json", "technicals.json", "iv.json", "shorts.json"] as const;
        const loaded = await Promise.all(files.map(async (file) => {
          const response = await fetch(datasetUrl(file));
          if (!response.ok) return { file, body: null };
          return { file, body: await response.json() };
        }));
        if (stopped) return;
        const universe = loaded.find((item) => item.file === "universe.json")?.body;
        const base: ScreenerRow[] = Array.isArray(universe?.rows) ? universe.rows : [];
        const technicals = loaded.find((item) => item.file === "technicals.json")?.body?.rows ?? {};
        const ivRows = loaded.find((item) => item.file === "iv.json")?.body?.rows ?? [];
        const shortRows = loaded.find((item) => item.file === "shorts.json")?.body?.rows ?? [];
        const ivMap: Record<string, Partial<ScreenerRow>> = {};
        for (const row of ivRows) {
          if (row?.symbol) ivMap[row.symbol] = { iv30: row.iv30 ?? null, ivr: row.ivr ?? null, vrp: row.vrp ?? null };
        }
        const shortMap: Record<string, Partial<ScreenerRow>> = {};
        for (const row of shortRows) {
          const symbol = row.symbolCode ?? row.symbol;
          if (!symbol) continue;
          shortMap[symbol] = { si_pct_float: row.si_pct_float ?? null, dtc: row.daysToCover ?? row.dtc ?? null };
        }
        setRows(joinRows(base, [technicals && !Array.isArray(technicals) ? technicals : {}, ivMap, shortMap]));
        setSources(loaded.map((item) => ({
          source: item.body?.meta?.source ?? item.file,
          asOf: item.body?.meta?.asOf ?? null,
          unavailable: item.body == null || Boolean(item.body?.meta?.unavailable),
        })));
        setError(base.length ? null : "The Nasdaq universe file is not on this build.");
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "The screener did not load.");
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("cols", columns.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [query, columns]);

  const token = query.split(/\s+/).at(-1) ?? "";
  const suggestions = suggestFields(token).slice(0, 6);
  let parseError: string | null = null;
  let matches: ScreenerRow[] = [];
  try {
    parseQuery(query);
    matches = rows.filter((row) => matchQuery(row, query));
  } catch (err) {
    parseError = err instanceof Error ? err.message : "The query could not be read.";
  }

  const caret = useMemo(() => parseError, [parseError]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <DataBadge key={source.source} source={source.source} asOf={source.asOf} unavailable={source.unavailable} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESET_SCREENS.map((preset) => (
          <button key={preset.name} type="button" className="h-8 rounded-full px-2 text-[11px] text-muted-foreground" onClick={() => setQuery(preset.query)}>
            {preset.name}
          </button>
        ))}
      </div>
      <label className="text-sm">
        Query
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-border bg-card px-2 font-mono text-xs" />
      </label>
      {suggestions.length ? <p className="text-[11px] text-muted-foreground">Fields: {suggestions.join(", ")}</p> : null}
      {caret ? <p className="text-sm text-bearish">{caret}</p> : null}
      {loading ? <PanelState kind="loading" detail="Loading the universe." /> : null}
      {error ? <PanelState kind="unavailable" detail={error} /> : null}
      {!loading && !error && matches.length === 0 ? <PanelState kind="empty" /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{matches.length.toLocaleString("en-US")} rows. A blank cell was missing at the source. It is not zero.</span>
        <button
          type="button"
          className="h-8 rounded-full px-3"
          onClick={() => {
            const blob = new Blob([toCsv(matches, columns)], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "screener.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto text-[11px]">
        {SCREENER_FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-1 whitespace-nowrap">
            <input
              type="checkbox"
              checked={columns.includes(field)}
              onChange={() => setColumns((current) => (current.includes(field) ? current.filter((item) => item !== field) : [...current, field]))}
            />
            {field}
          </label>
        ))}
      </div>
      <VirtualTable
        rows={matches}
        rowKey={(row) => String(row.symbol)}
        render={(row) => (
          <div className="flex h-10 items-center gap-3 px-2 text-xs">
            {columns.map((column) => (
              <span key={column} className="w-28 truncate">
                {column === "symbol" && row.symbol ? <Link href={tickerPath(String(row.symbol))} className="font-mono underline-offset-2 hover:underline">{row.symbol}</Link> : formatCell(row[column])}
              </span>
            ))}
          </div>
        )}
      />
    </div>
  );
}

function formatCell(value: string | number | null | undefined): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
  }
  return value;
}
