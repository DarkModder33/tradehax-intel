"use client";
import { formatDigits } from "@/lib/format";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchChain } from "@/lib/sources/cboe";
import { expectedMove } from "@/lib/options/expectedMove";
import { realizedMove } from "@/lib/options/realized";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";

export function EarningsCompare() {
  const [symbol, setSymbol] = useState("NVDA");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          void (async () => {
            const chain = await fetchChain(symbol);
            const front = chain.contracts.map((contract) => contract.expiry).sort()[0];
            const implied = front ? expectedMove(chain.contracts, chain.spot, front) : null;
            const chart = parseYahooChart(await (await fetch(yahooChartRequestUrl(symbol, "1d", "5y"))).json(), symbol);
            const closes = chart.bars.map((bar) => ({ date: new Date(bar.time).toISOString().slice(0, 10), close: bar.close }));
            const last = closes.at(-1)?.date ?? "";
            const realized = realizedMove(closes, last, 1);
            setText(
              `Current straddle ${implied ? `±${formatDigits((implied.percent * 100), 2)}% into ${implied.expiry}` : "unavailable"}. The last daily close-to-close move was ${realized == null ? "n/a" : `${formatDigits((realized * 100), 2)}%`}. That is not the move on a past earnings date. Historical implied moves need a chain stored on each report date, and this build does not have those chains.`,
            );
          })().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not compare."));
        }}
      >
        <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="h-8 w-28 rounded-md border border-border bg-card px-2 font-mono uppercase" aria-label="Earnings ticker" />
        <Button type="submit" size="sm" variant="outline">Compare</Button>
      </form>
      {error ? <p className="text-sm text-bearish">{error}</p> : null}
      {text ? <p className="text-sm leading-relaxed">{text}</p> : null}
    </div>
  );
}
