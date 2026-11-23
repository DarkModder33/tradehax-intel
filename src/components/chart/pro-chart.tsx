"use client";
import { formatDigits } from "@/lib/format";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { DataBadge } from "@/components/data-badge";
import { useChartState } from "@/components/chart/use-chart-state";
import { flowMarkers, gexPriceLines, offexLines } from "@/lib/chart/overlays";
import { CHART_TIMEFRAMES, indicatorPeriod, type ChartQuery, type ChartTimeframe } from "@/lib/chart/url-state";
import type { FlowPrint } from "@/lib/flow/classify";
import { atr } from "@/lib/indicators/atr";
import { bollinger } from "@/lib/indicators/bollinger";
import { ema } from "@/lib/indicators/ema";
import { keltner } from "@/lib/indicators/keltner";
import { macd } from "@/lib/indicators/macd";
import { obv } from "@/lib/indicators/obv";
import { rsi } from "@/lib/indicators/rsi";
import { sma } from "@/lib/indicators/sma";
import { stoch } from "@/lib/indicators/stoch";
import type { Bar } from "@/lib/indicators/types";
import { anchoredVwap, sessionKey, sessionVwap } from "@/lib/indicators/vwap";
import { workerUrl } from "@/lib/live/worker";
import { fetchWorkerChart } from "@/lib/market/worker-bars";
import { parseYahooChart, yahooChartRequestUrl } from "@/lib/market/yahoo";
import { fetchChainSummary } from "@/lib/options/load-summary";
import type { ChainSummary } from "@/lib/options/summary";

const STUDIES = ["ema20", "sma50", "bb20", "vwap", "keltner20", "rsi14", "macd", "atr14", "stoch", "obv"] as const;
const YAHOO: Record<ChartTimeframe, [string, string]> = {
  "1m": ["1m", "1d"],
  "5m": ["5m", "5d"],
  "15m": ["15m", "5d"],
  "1h": ["60m", "3mo"],
  "1d": ["1d", "1y"],
};

interface Loaded {
  bars: Bar[];
  source: string;
  compare: Bar[] | null;
  summary: ChainSummary | null;
  prints: FlowPrint[];
  offex: { price: number; notional: number }[];
}

function stamp(time: number): UTCTimestamp {
  return Math.floor(time / 1000) as UTCTimestamp;
}

function linePoints(bars: Bar[], values: Array<number | null>) {
  const points: { time: UTCTimestamp; value: number }[] = [];
  let last = -1;
  for (let index = 0; index < bars.length; index += 1) {
    const value = values[index];
    const time = stamp(bars[index].time);
    if (value == null || !Number.isFinite(value) || time <= last) continue;
    points.push({ time, value });
    last = time;
  }
  return points;
}

async function loadBars(symbol: string, timeframe: ChartTimeframe): Promise<{ bars: Bar[]; source: string }> {
  const viaWorker = await fetchWorkerChart(symbol, timeframe === "1h" ? "1h" : timeframe, timeframe === "1d" ? "1y" : "5d");
  if (viaWorker?.bars.length) return { bars: viaWorker.bars, source: "Alpaca SIP via worker" };
  const [interval, range] = YAHOO[timeframe];
  const response = await fetch(yahooChartRequestUrl(symbol, interval, range));
  if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
  return { bars: parseYahooChart(await response.json(), symbol).bars, source: "Yahoo Finance via proxy" };
}

export function ProChart() {
  const { query, replace } = useChartState();
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [readout, setReadout] = useState("Crosshair values show here.");
  const [symbolDraft, setSymbolDraft] = useState(query.symbol);

  useEffect(() => {
    const timer = window.setTimeout(() => setSymbolDraft(query.symbol), 0);
    return () => window.clearTimeout(timer);
  }, [query.symbol]);

  useEffect(() => {
    let stopped = false;
    const timer = window.setTimeout(() => setLoading(true), 0);
    void (async () => {
      try {
        const primary = await loadBars(query.symbol, query.timeframe);
        const compare = query.compare ? await loadBars(query.compare, query.timeframe).catch(() => null) : null;
        let summary: ChainSummary | null = null;
        let prints: FlowPrint[] = [];
        let offex: { price: number; notional: number }[] = [];
        if (query.overlays.includes("gex")) summary = await fetchChainSummary(query.symbol).catch(() => null);
        if (query.overlays.includes("flow")) {
          const response = await fetch(`${workerUrl()}/v1/flow?symbol=${query.symbol}&limit=80`).catch(() => null);
          if (response?.ok) prints = ((await response.json()) as { prints?: FlowPrint[] }).prints ?? [];
        }
        if (query.overlays.includes("offex")) {
          const response = await fetch(`${workerUrl()}/v1/offex?symbol=${query.symbol}&limit=20`).catch(() => null);
          if (response?.ok) offex = ((await response.json()) as { prints?: { price: number; notional: number }[] }).prints ?? [];
        }
        if (!stopped) {
          setLoaded({ bars: primary.bars, source: primary.source, compare: compare?.bars ?? null, summary, prints, offex });
          setError(primary.bars.length ? null : "No bars came back.");
        }
      } catch (err) {
        if (!stopped) {
          setLoaded(null);
          setError(err instanceof Error ? err.message : "The chart did not load.");
        }
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [query.symbol, query.timeframe, query.compare, query.overlays]);

  useEffect(() => {
    if (!host.current || !loaded?.bars.length) return;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#c4c4c4", attributionLogo: true },
      grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      rightPriceScale: { mode: query.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
      timeScale: { timeVisible: query.timeframe !== "1d", secondsVisible: false },
    });
    chartRef.current = chart;
    const bars = loaded.bars;
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#61da92",
      downColor: "#f97676",
      borderVisible: false,
      wickUpColor: "#61da92",
      wickDownColor: "#f97676",
    });
    candle.setData(bars.map((bar) => ({ time: stamp(bar.time), open: bar.open, high: bar.high, low: bar.low, close: bar.close })));
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" } });
    volume.setData(bars.map((bar) => ({
      time: stamp(bar.time),
      value: bar.volume,
      color: bar.close >= bar.open ? "rgba(97, 218, 146, 0.45)" : "rgba(249, 118, 118, 0.45)",
    })));
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const closes = bars.map((bar) => bar.close);
    const addLine = (values: Array<number | null>, color: string, pane = 0, scale = "right") => {
      const target = pane === 0 ? chart : chart.addPane();
      const series = target.addSeries(LineSeries, { color, lineWidth: 2, priceScaleId: scale });
      series.setData(linePoints(bars, values));
      return series;
    };
    for (const token of query.indicators) {
      if (token.startsWith("sma")) addLine(sma(closes, indicatorPeriod(token, 20)), "#d6d6d6");
      else if (token.startsWith("ema")) addLine(ema(closes, indicatorPeriod(token, 20)), "#ebc669");
      else if (token.startsWith("bb")) {
        const bands = bollinger(closes, indicatorPeriod(token, 20));
        addLine(bands.map((point) => point.upper), "#9bb0c7");
        addLine(bands.map((point) => point.middle), "#9bb0c7");
        addLine(bands.map((point) => point.lower), "#9bb0c7");
      } else if (token === "vwap" || token.startsWith("vwap")) {
        const values = bars.map((bar) => sessionVwap(bars, sessionKey(bar.time)));
        addLine(values, "#2cecf5");
      } else if (token.startsWith("keltner")) {
        const bands = keltner(bars, indicatorPeriod(token, 20));
        addLine(bands.map((point) => point.upper), "#f5a06f");
        addLine(bands.map((point) => point.middle), "#f5a06f");
        addLine(bands.map((point) => point.lower), "#f5a06f");
      } else if (token.startsWith("rsi")) addLine(rsi(closes, indicatorPeriod(token, 14)), "#ebc669", 1);
      else if (token === "macd") {
        const points = macd(closes);
        addLine(points.map((point) => point.macd), "#d6d6d6", 1);
        addLine(points.map((point) => point.histogram), "#61da92", 1);
      } else if (token.startsWith("atr")) addLine(atr(bars, indicatorPeriod(token, 14)), "#90bce9", 1);
      else if (token.startsWith("stoch")) addLine(stoch(bars).map((point) => point.k), "#ebc669", 1);
      else if (token === "obv") addLine(obv(bars), "#d6d6d6", 1);
    }
    if (query.anchor) addLine(anchoredVwap(bars, query.anchor), "#ffffff");
    if (loaded.compare?.length) {
      const base = loaded.compare[0].close;
      const first = bars[0].close;
      const byTime = new Map(loaded.compare.map((bar) => [stamp(bar.time), bar.close]));
      const series = chart.addSeries(LineSeries, { color: "#c1a9ee", lineWidth: 2, priceScaleId: "right" });
      series.setData(bars.flatMap((bar) => {
        const other = byTime.get(stamp(bar.time));
        if (other == null || base === 0) return [];
        return [{ time: stamp(bar.time), value: first * (other / base) }];
      }));
    }
    if (loaded.summary) {
      for (const line of gexPriceLines(loaded.summary)) {
        candle.createPriceLine({ price: line.price, title: line.title, color: line.color, lineWidth: 1, axisLabelVisible: true });
      }
    }
    for (const line of offexLines(loaded.offex)) {
      candle.createPriceLine({ price: line.price, title: line.title, color: line.color, lineWidth: 1, axisLabelVisible: true });
    }
    const markers = flowMarkers(loaded.prints).map((marker) => ({
      time: stamp(marker.time),
      position: "aboveBar" as const,
      color: marker.color,
      shape: "circle" as const,
      size: marker.size,
      text: marker.text,
    }));
    if (markers.length) createSeriesMarkers(candle, markers);
    chart.subscribeCrosshairMove((param) => {
      const row = bars.find((bar) => stamp(bar.time) === param.time);
      if (!row) return;
      const index = bars.indexOf(row);
      const bits = [`O ${formatDigits(row.open, 2)} H ${formatDigits(row.high, 2)} L ${formatDigits(row.low, 2)} C ${formatDigits(row.close, 2)} V ${Math.round(row.volume)}`];
      for (const token of query.indicators) {
        if (token.startsWith("rsi")) {
          const value = rsi(closes, indicatorPeriod(token, 14))[index];
          if (value != null) bits.push(`RSI ${formatDigits(value, 1)}`);
        }
      }
      setReadout(bits.join(" · "));
    });
    chart.subscribeClick((param) => {
      const row = bars.find((bar) => stamp(bar.time) === param.time);
      if (!row) return;
      replace({ ...query, anchor: row.time });
    });
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [loaded, query, replace]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const chart = chartRef.current;
      if (event.key === "i") {
        setMenu((open) => !open);
        return;
      }
      if (!chart) return;
      const range = chart.timeScale().getVisibleLogicalRange();
      if ((event.key === "+" || event.key === "-" || event.key === "=") && range) {
        const span = (range.to - range.from) * (event.key === "-" ? 1.25 : 0.8);
        const mid = (range.from + range.to) / 2;
        chart.timeScale().setVisibleLogicalRange({ from: mid - span / 2, to: mid + span / 2 });
      }
      if (event.key === "ArrowLeft") chart.timeScale().scrollToPosition(chart.timeScale().scrollPosition() + 6, false);
      if (event.key === "ArrowRight") chart.timeScale().scrollToPosition(chart.timeScale().scrollPosition() - 6, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleIndicator = (token: string) => {
    const indicators = query.indicators.includes(token) ? query.indicators.filter((item) => item !== token) : [...query.indicators, token];
    replace({ ...query, indicators });
  };
  const toggleOverlay = (token: ChartQuery["overlays"][number]) => {
    const overlays = query.overlays.includes(token) ? query.overlays.filter((item) => item !== token) : [...query.overlays, token];
    replace({ ...query, overlays });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            replace({ ...query, symbol: symbolDraft.trim().toUpperCase() || query.symbol });
          }}
        >
          <input value={symbolDraft} onChange={(event) => setSymbolDraft(event.target.value.toUpperCase())} aria-label="Symbol" className="h-10 w-28 rounded-md border border-border bg-card px-2 font-mono text-sm" />
        </form>
        {CHART_TIMEFRAMES.map((tf) => (
          <button key={tf} type="button" onClick={() => replace({ ...query, timeframe: tf })} className={`h-10 rounded-full px-3 text-xs ${query.timeframe === tf ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            {tf}
          </button>
        ))}
        <button type="button" onClick={() => setMenu((open) => !open)} className="h-10 rounded-full px-3 text-xs text-muted-foreground">Studies</button>
        <button type="button" onClick={() => replace({ ...query, log: !query.log })} className="h-10 rounded-full px-3 text-xs text-muted-foreground">{query.log ? "Log" : "Linear"}</button>
        <button
          type="button"
          className="h-10 rounded-full px-3 text-xs text-muted-foreground"
          onClick={() => void navigator.clipboard.writeText(window.location.href)}
        >
          Share
        </button>
      </div>
      {menu ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border p-3 text-xs">
          {STUDIES.map((token) => (
            <label key={token} className="flex items-center gap-1">
              <input type="checkbox" checked={query.indicators.includes(token)} onChange={() => toggleIndicator(token)} />
              {token}
            </label>
          ))}
          {(["gex", "flow", "offex"] as const).map((token) => (
            <label key={token} className="flex items-center gap-1">
              <input type="checkbox" checked={query.overlays.includes(token)} onChange={() => toggleOverlay(token)} />
              {token}
            </label>
          ))}
          <label className="flex items-center gap-1">
            Compare
            <input defaultValue={query.compare ?? ""} aria-label="Compare symbol" className="h-8 w-20 rounded-md border border-border bg-card px-2 font-mono" onBlur={(event) => replace({ ...query, compare: event.target.value.trim().toUpperCase() || null })} />
          </label>
        </div>
      ) : null}
      <DataBadge source={loaded?.source ?? "Bars"} delay="about 15 min" unavailable={Boolean(error)} />
      {query.overlays.includes("gex") ? <DataBadge source={loaded?.summary?.source ?? "Chain summary"} asOf={loaded?.summary?.asOf} delay={loaded?.summary?.delay} unavailable={!loaded?.summary && !loading} /> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading bars.</p> : null}
      {error ? <p className="rounded-xl border border-bearish/40 bg-bearish/10 px-4 py-3 text-sm">{error}</p> : null}
      <p className="font-mono text-xs text-muted-foreground">{readout}</p>
      <div ref={host} className="h-[60vh] w-full min-h-80 md:h-[70vh]" />
      <p className="text-[11px] text-muted-foreground">Click a bar to anchor VWAP. Keys: + and − zoom, arrows pan, i studies. Charting by TradingView Lightweight Charts (Apache-2.0).</p>
    </div>
  );
}
