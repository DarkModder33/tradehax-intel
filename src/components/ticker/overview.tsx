"use client";

import { useEffect, useState } from "react";
import { DataBadge } from "@/components/data-badge";
import { readTicker } from "@/lib/ticker/route";
import { fetchChain } from "@/lib/sources/cboe";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";
import { buildSignal } from "@/lib/indicators/build-signal";
import { buildExposure } from "@/lib/options/exposure";
import { expectedMove } from "@/lib/options/expectedMove";
import { maxPain } from "@/lib/options/maxpain";
import { termStructure } from "@/lib/options/iv";
import { datasetUrl } from "@/lib/sources/manifest";
import { workerUrl } from "@/lib/live/worker";
import { formatEt, formatPrice } from "@/lib/format";
import type { FlowPrint } from "@/lib/flow/classify";

export function TickerOverview() {
  const [symbol, setSymbol] = useState("SPY");
  const [price, setPrice] = useState<number | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const [signal, setSignal] = useState<string | null>(null);
  const [gamma, setGamma] = useState<string | null>(null);
  const [pain, setPain] = useState<string | null>(null);
  const [move, setMove] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [prints, setPrints] = useState<FlowPrint[]>([]);
  const [net, setNet] = useState<string | null>(null);
  const [levels, setLevels] = useState<string | null>(null);
  const [filings, setFilings] = useState<string[]>([]);
  const [news, setNews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => setSymbol(readTicker(window.location.search, window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const chart = await fetch(yahooChartRequestUrl(symbol, "1d", "6mo")).then((response) => response.json());
        const parsed = parseYahooChart(chart, symbol);
        if (stopped) return;
        setPrice(parsed.quote.price);
        setTrail(parsed.bars.slice(-60).map((bar) => bar.close));
        const scored = buildSignal(symbol, "1d", parsed.bars);
        setSignal(`${scored.direction} ${scored.probability}% on the daily vote`);
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Price history did not load.");
      }
      try {
        const chain = await fetchChain(symbol);
        if (stopped) return;
        const book = buildExposure(chain, new Date());
        const front = chain.contracts.map((contract) => contract.expiry).sort()[0];
        setGamma(`${book.levels.regime}. Net ${(book.levels.netGex / 1e9).toFixed(2)}B per 1%. Call wall ${book.levels.callWall ?? "n/a"}, put wall ${book.levels.putWall ?? "n/a"}.`);
        setPain(front ? `${maxPain(chain.contracts.filter((contract) => contract.expiry === front)) ?? "n/a"} on ${front}` : "n/a");
        const em = front ? expectedMove(chain.contracts, chain.spot, front) : null;
        setMove(em ? `±${(em.percent * 100).toFixed(2)}% into ${em.expiry}` : "n/a");
        const iv = termStructure(chain.contracts, chain.spot, new Date()).find((point) => point.iv != null);
        setTerm(iv?.iv != null ? `Nearest ATM IV ${(iv.iv * 100).toFixed(1)}%. Rank needs 252 stored sessions; history is still building.` : "IV term unavailable");
      } catch {
        if (!stopped) setGamma("Chain unavailable.");
      }
      try {
        const [flow, netflow, offex] = await Promise.all([
          fetch(`${workerUrl()}/v1/flow?symbol=${symbol}&limit=12`).then((response) => response.json()),
          fetch(`${workerUrl()}/v1/netflow/${symbol}`).then((response) => response.json()),
          fetch(`${workerUrl()}/v1/offex?symbol=${symbol}&limit=8`).then((response) => response.json()),
        ]);
        if (stopped) return;
        setPrints(flow.prints ?? []);
        const tide = netflow.tide;
        setNet(tide ? `Net call $${(tide.netCallPremium / 1e6).toFixed(2)}M, net put $${(tide.netPutPremium / 1e6).toFixed(2)}M. NOPE ${netflow.nope == null ? "n/a" : Number(netflow.nope).toFixed(3)}.` : "Net flow unavailable.");
        const rows = offex.prints ?? [];
        setLevels(rows.length ? `${rows.length} recent off-exchange prints. Largest $${Math.round(Math.max(...rows.map((row: { notional: number }) => row.notional)) / 1000)}k.` : "No off-exchange prints for this name in the worker window.");
      } catch {
        if (!stopped) setNet("Worker net flow did not load.");
      }
      try {
        const [insiders, congress] = await Promise.all([
          fetch(datasetUrl("insiders.json")).then((response) => response.json()),
          fetch(datasetUrl("congress.json")).then((response) => response.json()),
        ]);
        if (stopped) return;
        const lines: string[] = [];
        for (const row of insiders.rows ?? []) {
          const ticker = row.trade?.ticker;
          if (ticker === symbol) lines.push(`Insider ${row.trade.owner} ${row.trade.code} ${row.trade.shares}`);
        }
        for (const row of congress.rows ?? []) {
          if (String(row.ticker ?? "") === symbol || String(row.name ?? "").includes(symbol)) lines.push(`Congress filing ${row.name ?? row.ticker}`);
        }
        setFilings(lines.slice(0, 6));
      } catch {
        if (!stopped) setFilings([]);
      }
      try {
        const search = await fetch(`https://proxy.cors.dev/https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=3&quotesCount=0`).then((response) => response.json());
        const titles = (search?.news ?? []).map((item: { title?: string }) => item.title).filter(Boolean) as string[];
        if (!stopped) setNews(titles);
      } catch {
        if (!stopped) setNews([]);
      }
    };
    void load();
    return () => {
      stopped = true;
    };
  }, [symbol]);

  return (
    <div className="flex flex-col gap-4">
      <DataBadge source="Yahoo, Cboe delayed, worker" delay="about 15 min" />
      <h2 className="font-mono text-2xl">{symbol} {price == null ? "" : formatPrice(price)}</h2>
      {error ? <p className="text-sm text-bearish">{error}</p> : null}
      <Spark values={trail} />
      <Section title="Daily signal" body={signal} />
      <Section title="Gamma, max pain, expected move" body={[gamma, `Max pain ${pain}`, `Expected move ${move}`].filter(Boolean).join(" ")} />
      <Section title="IV" body={term} />
      <Section title="Net premium" body={net} />
      <Section title="Recent flow" body={prints.length ? prints.slice(0, 6).map((print) => `${formatEt(Date.parse(print.time))} ${print.right} ${print.strike} ${print.side} $${Math.round(print.premium)}`).join(" · ") : "No prints in the worker window."} />
      <Section title="Off-exchange" body={levels} />
      <Section title="Insiders and Congress" body={filings.length ? filings.join(" · ") : "No matching rows in the latest precompute. 13F holdings are not expanded."} />
      <Section title="Short interest" body="The precomputed short file is an AAPL sample. A per-ticker short-interest history is not stored yet." />
      <Section title="Earnings" body={move ? `Current expected move ${move}. A past implied-versus-realized table needs a chain saved on each report date.` : "Earnings date is on the calendar file when Nasdaq listed it."} />
      <Section title="News" body={news.length ? news.join(" · ") : "No headlines returned."} />
      <Section title="Seasonality" body="Month-of-year stats on the seasonality page are SPY, not this ticker, unless the nightly file is rebuilt per name." />
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  return (
    <section className="rounded-xl bg-card/70 px-3 py-2 ring-1 ring-foreground/10">
      <h3 className="text-[11px] tracking-[0.14em] text-gold uppercase">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed">{body ?? "Loading."}</p>
    </section>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 28 - ((value - min) / span) * 24;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return <svg viewBox="0 0 100 28" className="h-16 w-full" aria-hidden="true"><path d={d} fill="none" stroke="var(--gold)" strokeWidth="1.2" /></svg>;
}
