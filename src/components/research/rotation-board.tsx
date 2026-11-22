"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PanelState } from "@/components/panel-state";
import { correlationMatrix, logReturns } from "@/lib/stats/correlation";
import { relativeStrength } from "@/lib/stats/rs";
import { formatDigits } from "@/lib/format";
import { fetchWorkerChart } from "@/lib/market/worker-bars";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";

const NAMES = ["SPY", "XLK", "XLF", "XLE", "TLT", "GLD", "IWM"];

async function closes(symbol: string): Promise<number[]> {
  const viaWorker = await fetchWorkerChart(symbol, "1d", "1y");
  const bars = viaWorker?.bars ?? parseYahooChart(await (await fetch(yahooChartRequestUrl(symbol, "1d", "1y"))).json(), symbol).bars;
  return bars.map((bar) => bar.close);
}

export function RotationBoard() {
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<{ symbol: string; ratio: number; momentum: number }[]>([]);
  const [matrix, setMatrix] = useState<number[][]>([]);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const series = await Promise.all(NAMES.map(async (symbol) => ({ symbol, close: await closes(symbol) })));
        if (stopped) return;
        const spy = series.find((item) => item.symbol === "SPY")?.close ?? [];
        setRows(series.filter((item) => item.symbol !== "SPY").flatMap((item) => {
          const point = relativeStrength(item.close, spy, 10);
          return point ? [{ symbol: item.symbol, ratio: point.ratio, momentum: point.momentum }] : [];
        }));
        setMatrix(correlationMatrix(series.map((item) => logReturns(item.close).slice(-60))));
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Rotation data did not load.");
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  if (error) return <PanelState kind="error" detail={error} />;
  if (!rows.length) return <PanelState kind="loading" detail="Loading daily bars for sectors and SPY." />;
  return (
    <div className="flex flex-col gap-4">
      <svg viewBox="0 0 200 200" className="h-64 w-full max-w-md" role="img" aria-label="Relative strength versus momentum">
        <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(255,255,255,0.2)" />
        <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,255,255,0.2)" />
        {rows.map((row) => (
          <g key={row.symbol}>
            <circle cx={100 + (row.ratio - 100) * 4} cy={100 - (row.momentum - 100) * 4} r="4" fill="var(--gold)" />
            <text x={104 + (row.ratio - 100) * 4} y={100 - (row.momentum - 100) * 4} fontSize="8" fill="currentColor">{row.symbol}</text>
          </g>
        ))}
      </svg>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>{["", ...NAMES].map((name) => <th key={name} className="p-1">{name}</th>)}</tr>
          </thead>
          <tbody>
            {NAMES.map((name, row) => (
              <tr key={name}>
                <th className="p-1 text-left">{name}</th>
                {NAMES.map((other, column) => (
                  <td key={other} className="p-1">
                    <Link href={`/chart/?s=${name}&cmp=${other}`}>{matrix[row]?.[column] == null ? "—" : formatDigits(matrix[row][column], 2)}</Link>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
