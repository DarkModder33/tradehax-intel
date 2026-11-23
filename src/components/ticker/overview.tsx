"use client";

import Link from "next/link";
import { AlertsStrip } from "@/components/alerts/feed";
import { partyLetter } from "@/lib/datasets/congress-view";
import { DEFAULT_UNIVERSE } from "@/lib/live/universe";
import { useEffect, useState } from "react";
import { LineChart } from "@/components/chart/series";
import { DataBadge } from "@/components/data-badge";
import { chartPath, readTicker, readTickerTab, tickerTabPath, TICKER_TABS, type TickerTab } from "@/lib/ticker/route";
import { fetchChain } from "@/lib/sources/cboe";
import { fetchNews } from "@/lib/market/news";
import { fetchWorkerChart } from "@/lib/market/worker-bars";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";
import { buildSignal } from "@/lib/indicators/build-signal";
import { buildExposure } from "@/lib/options/exposure";
import { expectedMove } from "@/lib/options/expectedMove";
import { maxPain } from "@/lib/options/maxpain";
import { termStructure } from "@/lib/options/iv";
import { datasetUrl } from "@/lib/sources/manifest";
import { workerUrl } from "@/lib/live/worker";
import { formatDigits, formatEt, formatPrice } from "@/lib/format";
import type { FlowPrint } from "@/lib/flow/classify";

export function TickerOverview() {
  const [symbol, setSymbol] = useState("SPY");
  const [tab, setTab] = useState<TickerTab>("overview");
  const [starred, setStarred] = useState(false);
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
    const apply = () => {
      const next = readTicker(window.location.search, window.location.hash);
      setSymbol(next);
      setTab(readTickerTab(window.location.search));
      const saved = window.localStorage.getItem("tradehax-watchlist") ?? "";
      setStarred(saved.split(",").filter(Boolean).includes(next));
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const viaWorker = await fetchWorkerChart(symbol, "1d", "6mo");
        const parsed = viaWorker ?? parseYahooChart(await fetch(yahooChartRequestUrl(symbol, "1d", "6mo")).then((response) => response.json()), symbol);
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
        setGamma(`${book.levels.regime}. Net ${formatDigits((book.levels.netGex / 1e9), 2)}B per 1%. Call wall ${book.levels.callWall ?? "n/a"}, put wall ${book.levels.putWall ?? "n/a"}.`);
        setPain(front ? `${maxPain(chain.contracts.filter((contract) => contract.expiry === front)) ?? "n/a"} on ${front}` : "n/a");
        const em = front ? expectedMove(chain.contracts, chain.spot, front) : null;
        setMove(em ? `±${formatDigits((em.percent * 100), 2)}% into ${em.expiry}` : "n/a");
        const iv = termStructure(chain.contracts, chain.spot, new Date()).find((point) => point.iv != null);
        setTerm(iv?.iv != null ? `Nearest ATM IV ${formatDigits((iv.iv * 100), 1)}%. Rank needs 252 stored sessions; history is still building.` : "IV term unavailable");
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
        setNet(tide ? `Net call $${formatDigits((tide.netCallPremium / 1e6), 2)}M, net put $${formatDigits((tide.netPutPremium / 1e6), 2)}M. NOPE ${netflow.nope == null ? "n/a" : formatDigits(Number(netflow.nope), 3)}.` : "Net flow unavailable.");
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
          if (String(row.ticker ?? "") !== symbol || !row.member) continue;
          lines.push(`Congress: ${row.member} (${partyLetter(row.party)}-${row.district ?? "?"}) ${String(row.type ?? "").toLowerCase()} ${row.amount ?? ""} on ${row.transactionDate ?? "?"}`);
        }
        setFilings(lines.slice(0, 6));
      } catch {
        if (!stopped) setFilings([]);
      }
      try {
        const search = await fetchNews(symbol, 3);
        if (!stopped) setNews(search.items.map((item) => item.title));
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
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-baseline gap-3">
          <Link href={chartPath(symbol)} className="font-mono text-2xl font-semibold tracking-tight hover:text-gold">{symbol}</Link>
          <span className="font-mono text-xl tabular-nums">{price == null ? "" : formatPrice(price)}</span>
          <button
            type="button"
            className={`chip ${starred ? "chip-active" : ""}`}
            aria-pressed={starred}
            onClick={() => {
              const saved = (window.localStorage.getItem("tradehax-watchlist") ?? "").split(",").filter(Boolean);
              const next = starred ? saved.filter((item) => item !== symbol) : [...new Set([...saved, symbol])];
              window.localStorage.setItem("tradehax-watchlist", next.join(","));
              setStarred(!starred);
            }}
          >
            {starred ? "On watchlist" : "Watch"}
          </button>
        </div>
        <DataBadge source="Yahoo, Cboe delayed, worker" delay="about 15 min" />
      </div>
      <nav aria-label="Ticker sections" className="-mt-2 flex overflow-x-auto border-b border-white/[0.06]">
        {TICKER_TABS.map((item) => (
          <Link
            key={item}
            href={tickerTabPath(symbol, item)}
            className={`-mb-px border-b px-3 py-2 text-[13px] capitalize transition-colors ${tab === item ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {item}
          </Link>
        ))}
      </nav>
      {error ? <p className="text-sm text-bearish">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-3">
          {tab === "overview" || tab === "chart" ? <div className="surface px-3 py-2"><Spark values={trail} /></div> : null}
          {tab === "chart" ? <p className="text-sm"><Link href={chartPath(symbol)} className="text-gold hover:underline">Open the full chart</Link></p> : null}
          {tab === "overview" ? <Section title="Daily signal" body={signal} /> : null}
          {tab === "overview" || tab === "options" ? <Section title="Gamma, max pain, expected move" body={[gamma, `Max pain ${pain}`, `Expected move ${move}`].filter(Boolean).join(" ")} /> : null}
          {tab === "options" ? <Section title="Implied volatility" body={term} /> : null}
          {tab === "options" ? <p className="text-sm"><Link href={`/chain/?s=${symbol}`} className="text-gold hover:underline">Chain</Link> · <Link href={`/gex/?s=${symbol}`} className="text-gold hover:underline">Gamma</Link></p> : null}
          {tab === "flow" ? <Section title="Net premium" body={net} /> : null}
          {tab === "flow" ? <Section title="Recent flow" body={prints.length ? prints.slice(0, 6).map((print) => `${formatEt(Date.parse(print.time))} ${print.right} ${print.strike} ${print.side} $${Math.round(print.premium)}`).join(" · ") : "No prints in the worker window."} /> : null}
          {tab === "flow" ? <Section title="Off-exchange" body={levels} /> : null}
          {tab === "filings" ? (
            <>
              <Section title="Insiders and Congress" body={filings.length ? filings.join(" · ") : "No matching rows in the latest precompute."} />
              <Link href={`/congress/?ticker=${encodeURIComponent(symbol)}`} className="text-sm text-gold underline-offset-4 hover:underline">
                Every Congress trade in {symbol}
              </Link>
            </>
          ) : null}
          {tab === "shorts" ? <Section title="Short interest" body="Short volume is on the shorts page. Days-to-cover stays blank until FINRA includes this symbol." /> : null}
          {tab === "earnings" ? (
            <>
              <Section title="Earnings" body={move ? `Current expected move ${move}.` : "Earnings date is on the calendar when Nasdaq listed it."} />
              <Link href={`/earnings/?s=${encodeURIComponent(symbol)}`} className="text-sm text-gold underline-offset-4 hover:underline">Implied vs actual history for {symbol}</Link>
            </>
          ) : null}
          {tab === "overview" ? <Section title="Headlines" body={news.length ? news.join(" · ") : "No headlines returned."} /> : null}
          {tab === "overview" ? (
            <p className="text-sm">
              {(DEFAULT_UNIVERSE as readonly string[]).includes(symbol) ? (
                <Link href={`/news/t/${symbol}/`} className="text-gold hover:underline">Desk stories for {symbol}</Link>
              ) : (
                <Link href="/news/" className="text-gold hover:underline">All desk stories</Link>
              )}
            </p>
          ) : null}
        </div>
        <AlertsStrip ticker={symbol} limit={10} title={`${symbol} alerts`} />
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  return (
    <section className="surface px-4 py-3">
      <h3 className="text-[11px] font-medium text-muted-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed">{body ?? "Loading."}</p>
    </section>
  );
}

function Spark({ values }: { values: number[] }) {
  return <LineChart values={values} className="h-16 w-full" label="Daily closes" />;
}
