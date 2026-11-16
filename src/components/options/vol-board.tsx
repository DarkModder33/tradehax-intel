"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { SymbolForm } from "@/components/options/symbol-form";
import { readSymbol, useChain } from "@/components/options/use-chain";
import { datasetUrl } from "@/lib/sources/manifest";
import { expectedMove } from "@/lib/options/expectedMove";
import { skew25, smile, termStructure, volSurface } from "@/lib/options/iv";
import { asDecimalVol, closeToCloseVol, ivPercentile, ivRank, rankLabel, varianceRiskPremium, type IvPoint } from "@/lib/options/ivrank";
import { fetchWorkerChart } from "@/lib/market/worker-bars";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";

export function VolBoard() {
  const [symbol, setSymbol] = useState(readSymbol);
  const { chain, error, loading } = useChain(symbol);
  const asOf = new Date();
  const term = chain ? termStructure(chain.contracts, chain.spot, asOf).filter((point) => point.dte >= 0).slice(0, 12) : [];
  const expiry = term[0]?.expiry;
  const points = chain && expiry ? smile(chain.contracts, expiry).filter((point) => Math.abs(point.strike - chain.spot) / chain.spot < 0.08) : [];
  const surface = chain ? volSurface(chain.contracts, chain.spot).filter((cell) => term.slice(0, 6).some((point) => point.expiry === cell.expiry)) : [];
  const [history, setHistory] = useState<Record<string, IvPoint[]>>({});
  const [hv, setHv] = useState<number | null>(null);
  useEffect(() => {
    let stopped = false;
    fetch(datasetUrl("iv-history.json"))
      .then((response) => (response.ok ? response.json() : { series: {} }))
      .then((body: { series?: Record<string, IvPoint[]> }) => {
        if (!stopped) setHistory(body.series ?? {});
      })
      .catch(() => {
        if (!stopped) setHistory({});
      });
    return () => {
      stopped = true;
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const viaWorker = await fetchWorkerChart(symbol, "1d", "1y");
        const bars = viaWorker?.bars ?? parseYahooChart(await (await fetch(yahooChartRequestUrl(symbol, "1d", "1y"))).json(), symbol).bars;
        if (!stopped) setHv(closeToCloseVol(bars.map((bar) => bar.close), 20));
      } catch {
        if (!stopped) setHv(null);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [symbol]);
  const series = history[symbol] ?? [];
  const ivSeries = series.map((point) => point[1]);
  const iv30 = chain?.iv30 == null ? null : asDecimalVol(chain.iv30);
  const vrp = varianceRiskPremium(iv30, hv);
  const front = term[0];
  const back = term.find((point) => point.dte >= 45 && point.dte <= 90) ?? term.at(-1);
  const slope = front?.iv != null && back?.iv != null && back !== front ? back.iv - front.iv : null;

  return (
    <div className="flex flex-col gap-4">
      <SymbolForm symbol={symbol} onSubmit={setSymbol} />
      {loading ? <p className="text-sm text-muted-foreground">Reading the delayed chain.</p> : null}
      {error ? <p className="rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">{error}</p> : null}
      {chain ? (
        <>
          <DataBadge source={chain.source} asOf={chain.asOf} delay={chain.delay} />
          <p className="text-sm">
            IV30 {iv30 == null ? "n/a" : `${(iv30 * 100).toFixed(1)}%`}. HV20 {hv == null ? "n/a" : `${(hv * 100).toFixed(1)}%`}. VRP {vrp == null ? "n/a" : `${(vrp * 100).toFixed(1)} pts`}.
            IV rank {rankLabel(ivSeries)}. Percentile {ivPercentile(ivSeries) == null ? "building" : `${((ivPercentile(ivSeries) ?? 0) * 100).toFixed(0)}`}.
            Term slope {slope == null ? "n/a" : `${(slope * 100).toFixed(1)} pts`}. 25Δ skew {expiry && skew25(chain.contracts, expiry) != null ? (skew25(chain.contracts, expiry)! * 100).toFixed(2) : "n/a"}.
          </p>
          <p className="text-[11px] text-muted-foreground">Rank and percentile stay on “building” until 20 nightly sessions are stored. Stored points for {symbol}: {series.length}. {ivRank(ivSeries) == null ? "No rank is shown from a short or flat history." : ""}</p>
          <section>
            <h2 className="mb-2 text-sm font-medium">Term structure and straddle move</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {term.map((point) => {
                const move = expectedMove(chain.contracts, chain.spot, point.expiry);
                return (
                  <li key={point.expiry} className="rounded-xl bg-card/80 px-3 py-2 text-sm ring-1 ring-foreground/10">
                    <p className="font-mono">{point.expiry}</p>
                    <p>ATM IV {point.iv == null ? "n/a" : `${(point.iv * 100).toFixed(1)}%`}</p>
                    <p>Expected move {move ? `±${(move.percent * 100).toFixed(2)}%` : "n/a"}</p>
                    <p className="text-xs text-muted-foreground">25Δ skew {skew25(chain.contracts, point.expiry) == null ? "n/a" : (skew25(chain.contracts, point.expiry)! * 100).toFixed(2)}</p>
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium">Smile, nearest expiry</h2>
            <div className="flex h-28 items-end gap-1">
              {points.map((point) => (
                <div key={`${point.strike}-${point.delta}`} className="flex-1 rounded-t bg-gold/80" style={{ height: `${Math.min(100, point.iv * 200)}%` }} title={`${point.strike} ${(point.iv * 100).toFixed(1)}%`} />
              ))}
            </div>
          </section>
          <section className="overflow-x-auto">
            <h2 className="mb-2 text-sm font-medium">Surface, moneyness by expiry</h2>
            <table className="text-xs">
              <tbody>
                {[0.9, 0.95, 1, 1.05, 1.1].map((moneyness) => (
                  <tr key={moneyness}>
                    <td className="pr-2 font-mono">{moneyness.toFixed(2)}</td>
                    {term.slice(0, 6).map((point) => {
                      const cell = surface.find((item) => item.expiry === point.expiry && item.moneyness === moneyness);
                      return <td key={point.expiry} className="px-2 py-1">{cell ? `${(cell.iv * 100).toFixed(0)}` : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
