"use client";
import { formatDigits } from "@/lib/format";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { SymbolForm } from "@/components/options/symbol-form";
import { readSymbol } from "@/components/options/use-chain";
import { finraShortVolumeUrl, parseFinraShortVolume, shortVolumeRatio, type ShortVolumeRow } from "@/lib/sources/finra";

function candidateDates(from = new Date()): string[] {
  const dates: string[] = [];
  for (let offset = 1; offset <= 10 && dates.length < 4; offset++) {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() - offset);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const d = String(day.getUTCDate()).padStart(2, "0");
    dates.push(`${y}${m}${d}`);
  }
  return dates;
}

export function ShortsBoard() {
  const [symbol, setSymbol] = useState(readSymbol);
  const [rows, setRows] = useState<ShortVolumeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    (async () => {
      for (const date of candidateDates()) {
        try {
          const response = await fetch(finraShortVolumeUrl(date));
          if (!response.ok) continue;
          const parsed = parseFinraShortVolume(await response.text()).filter((row) => row.symbol === symbol);
          if (stopped) return;
          setRows(parsed);
          setAsOf(parsed[0]?.date ?? null);
          setError(parsed.length ? null : `No FINRA row for ${symbol}.`);
          return;
        } catch {
          // Try the previous session.
        }
      }
      if (!stopped) {
        setRows(null);
        setError("FINRA short volume is unavailable.");
      }
    })();
    return () => {
      stopped = true;
    };
  }, [symbol]);

  const totalShort = rows?.reduce((sum, row) => sum + row.shortVolume, 0) ?? 0;
  const total = rows?.reduce((sum, row) => sum + row.totalVolume, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <SymbolForm symbol={symbol} onSubmit={setSymbol} />
      <DataBadge source="FINRA Reg SHO" asOf={asOf} delay="same evening" unavailable={Boolean(error) && !rows?.length} />
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      {rows && rows.length > 0 ? (
        <>
          <p className="text-sm">
            Short volume ratio {formatDigits((total > 0 ? (totalShort / total) * 100 : 0), 1)}% of FINRA-reported volume. This is not short interest, and borrow fee is n/a.
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-normal">Market</th>
                <th className="text-right font-normal">Short</th>
                <th className="text-right font-normal">Total</th>
                <th className="text-right font-normal">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.market} className="border-t border-border/60">
                  <td className="py-1">{row.market || "all"}</td>
                  <td className="text-right font-mono">{row.shortVolume.toLocaleString("en-US")}</td>
                  <td className="text-right font-mono">{row.totalVolume.toLocaleString("en-US")}</td>
                  <td className="text-right font-mono">{shortVolumeRatio(row) == null ? "n/a" : `${formatDigits(((shortVolumeRatio(row) ?? 0) * 100), 1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
