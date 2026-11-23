"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { PanelState } from "@/components/panel-state";
import { amountMid, isBuy, partyLetter, topTickers, type CongressRow } from "@/lib/datasets/congress-view";
import { formatCompact } from "@/lib/format";
import { datasetUrl, type DatasetMeta } from "@/lib/sources/manifest";
import { tickerPath } from "@/lib/ticker/route";
import { cn } from "@/lib/utils";

interface CongressFile {
  meta?: DatasetMeta & { note?: string };
  note?: string;
  rows?: CongressRow[];
  counts?: { filings: number; parsed: number; scanned: number; errors: number };
  senate?: { error?: string };
}

type Side = "all" | "buy" | "sell";
type Party = "all" | "D" | "R";

function PartyBadge({ party }: { party: string | null }) {
  const letter = partyLetter(party);
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        letter === "D" ? "bg-sky-500/20 text-sky-300" : letter === "R" ? "bg-rose-500/20 text-rose-300" : "bg-white/10 text-muted-foreground",
      )}
      title={party ?? "Party unknown"}
    >
      {letter}
    </span>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function CongressTrades() {
  const [file, setFile] = useState<CongressFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<Side>("all");
  const [party, setParty] = useState<Party>("all");
  const [limit, setLimit] = useState(60);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("ticker");
    const timer = initial ? window.setTimeout(() => setQuery(initial.toUpperCase()), 0) : undefined;
    fetch(datasetUrl("congress.json"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`congress.json ${response.status}`))))
      .then((body: CongressFile) => setFile(body))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "congress.json did not load"));
    return () => window.clearTimeout(timer);
  }, []);

  const rows = useMemo(() => (file?.rows ?? []).filter((row) => row && typeof row.ticker === "string"), [file]);
  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return rows.filter((row) => {
      if (side === "buy" && !isBuy(row.type)) return false;
      if (side === "sell" && isBuy(row.type)) return false;
      if (party !== "all" && partyLetter(row.party) !== party) return false;
      if (!needle) return true;
      return row.ticker === needle || row.member.toUpperCase().includes(needle) || row.asset.toUpperCase().includes(needle);
    });
  }, [rows, query, side, party]);
  const top = useMemo(() => topTickers(rows, daysAgo(30)), [rows]);
  const summary = useMemo(() => {
    const recent = rows.filter((row) => row.transactionDate >= daysAgo(30));
    const buys = recent.filter((row) => isBuy(row.type));
    return {
      trades: recent.length,
      members: new Set(recent.map((row) => row.member)).size,
      buyShare: recent.length ? buys.length / recent.length : null,
      dBuys: buys.filter((row) => partyLetter(row.party) === "D").length,
      rBuys: buys.filter((row) => partyLetter(row.party) === "R").length,
    };
  }, [rows]);

  if (error) return <PanelState kind="unavailable" detail={error} />;
  if (!file) return <PanelState kind="loading" detail="Loading parsed House filings." />;
  if (rows.length === 0) return <PanelState kind="empty" detail={file.meta?.error ?? "No trades parsed in the latest file."} />;

  return (
    <div className="flex flex-col gap-5">
      {file.meta ? <DataBadge source={file.meta.source} asOf={file.meta.asOf} delay={file.meta.delay} unavailable={file.meta.unavailable} stale={file.meta.stale} /> : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Trades, last 30 days", value: summary.trades.toLocaleString("en-US") },
          { label: "Members trading", value: summary.members.toLocaleString("en-US") },
          { label: "Share that were buys", value: summary.buyShare == null ? "n/a" : `${Math.round(summary.buyShare * 100)}%` },
          { label: "Buys by party", value: `D ${summary.dBuys} · R ${summary.rBuys}` },
        ].map((card) => (
          <div key={card.label} className="surface px-4 py-3">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-mono text-xl tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {top.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Most traded by members, last 30 days</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {top.map((item) => (
              <button
                key={item.ticker}
                type="button"
                onClick={() => setQuery(item.ticker)}
                className="surface shrink-0 px-3 py-2 text-left hover:border-gold/40"
              >
                <span className="block font-mono text-sm font-semibold">{item.ticker}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {item.members} member{item.members === 1 ? "" : "s"} · <span className="text-bullish">{item.buys} buy</span> / <span className="text-bearish">{item.sells} sell</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ticker or member"
          aria-label="Filter by ticker or member"
          className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm sm:w-64"
        />
        {(["all", "buy", "sell"] as Side[]).map((value) => (
          <button key={value} type="button" onClick={() => setSide(value)} className={cn("chip", side === value && "chip-active")}>
            {value === "all" ? "All" : value === "buy" ? "Buys" : "Sells"}
          </button>
        ))}
        {(["all", "D", "R"] as Party[]).map((value) => (
          <button key={value} type="button" onClick={() => setParty(value)} className={cn("chip", party === value && "chip-active")}>
            {value === "all" ? "Both parties" : value === "D" ? "Democrats" : "Republicans"}
          </button>
        ))}
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="text-xs text-muted-foreground underline">Clear</button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length.toLocaleString("en-US")} trades</span>
      </div>

      {filtered.length === 0 ? (
        <PanelState kind="empty" detail="No parsed trade matches that filter." />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left">Traded</th>
                <th scope="col" className="px-3 py-2.5 text-left">Member</th>
                <th scope="col" className="px-3 py-2.5 text-left">Ticker</th>
                <th scope="col" className="px-3 py-2.5 text-left">Type</th>
                <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                <th scope="col" className="px-3 py-2.5 text-left">Owner</th>
                <th scope="col" className="px-3 py-2.5 text-left">Filed</th>
                <th scope="col" className="px-3 py-2.5 text-left"><span className="sr-only">Source</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((row, index) => (
                <tr key={`${row.url}-${index}`} className="border-t border-white/[0.05]">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{row.transactionDate}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <PartyBadge party={row.party} />
                      <button type="button" className="text-left hover:text-gold" onClick={() => setQuery(row.member)}>{row.member}</button>
                      <span className="text-[11px] text-muted-foreground">{row.district}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={tickerPath(row.ticker)} className="font-mono font-semibold text-gold hover:underline">{row.ticker}</Link>
                    <span className="block max-w-[16rem] truncate text-[11px] text-muted-foreground" title={row.asset}>{row.asset}</span>
                  </td>
                  <td className={cn("px-3 py-2 whitespace-nowrap", isBuy(row.type) ? "text-bullish" : "text-bearish")}>{row.type}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap" title={`Midpoint ${formatCompact(amountMid(row))}`}>{row.amount}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.owner === "SP" ? "Spouse" : row.owner === "JT" ? "Joint" : row.owner === "DC" ? "Child" : "Self"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">{row.filed}</td>
                  <td className="px-3 py-2"><a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > limit ? (
            <div className="border-t border-white/[0.05] p-3 text-center">
              <button type="button" onClick={() => setLimit(limit + 100)} className="h-9 rounded-full border border-white/15 px-4 text-xs hover:border-white/30">
                Show more ({(filtered.length - limit).toLocaleString("en-US")} left)
              </button>
            </div>
          ) : null}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        {file.meta?.note ?? file.note} Amounts are the disclosed ranges, not exact values. Party comes from the public congress-legislators dataset. Senate: {file.senate?.error ?? "not parsed yet"}
      </p>
    </div>
  );
}
