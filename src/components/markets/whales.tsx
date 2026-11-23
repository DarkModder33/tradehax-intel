"use client";
import { formatCompact } from "@/lib/format";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";

export function WhaleBoard() {
  const [markets, setMarkets] = useState<string[]>([]);
  const [btc, setBtc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    fetch("https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=8")
      .then((response) => response.json())
      .then((body) => {
        if (stopped) return;
        const rows = Array.isArray(body) ? body : [];
        setMarkets(rows.map((row: { question?: string; volume?: number }) => `${row.question ?? "Market"} · ${formatCompact(Number(row.volume))} traded`).slice(0, 8));
      })
      .catch(() => {
        if (!stopped) setError("Polymarket did not answer the browser.");
      });
    fetch("https://mempool.space/api/v1/fees/recommended")
      .then((response) => response.json())
      .then((body) => {
        if (!stopped) setBtc(`Mempool recommended fee ${body.fastestFee ?? "n/a"} sat/vB. Individual large transfers are not listed by this free endpoint.`);
      })
      .catch(() => {
        if (!stopped) setBtc("Mempool.space did not answer.");
      });
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <DataBadge source="Polymarket and mempool.space" delay="as published" />
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      <section>
        <h2 className="text-sm font-medium">Prediction markets</h2>
        <ul className="mt-1 text-sm">{markets.map((line) => <li key={line}>{line}</li>)}</ul>
        {markets.length === 0 ? <p className="text-sm text-muted-foreground">No markets loaded.</p> : null}
      </section>
      <section>
        <h2 className="text-sm font-medium">Bitcoin</h2>
        <p className="text-sm">{btc ?? "Loading."}</p>
      </section>
      <p className="text-xs text-muted-foreground">Kalshi public markets are not called from the browser here. A keyless large-transfer feed was not available without inventing a whale threshold from a fee endpoint.</p>
    </div>
  );
}
