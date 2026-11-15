import { FORWARD_BARS } from "@/lib/backtest";
import { replayCalls, type BarCall } from "@/lib/indicators/factors";
import type { Bar, Timeframe } from "@/lib/indicators/types";
import { deflatedSharpe } from "@/lib/stats/dsr";
import { applySignificance, evaluateDirection, sharpeMoments, type CellStats } from "./backtest";
import { costBpsPerSide } from "./costs";
import { bvcImbalance } from "./features/bvc";
import { gapSplit } from "./features/gap";
import { intradayMomentum, noiseArea, openingRange } from "./features/intraday";
import { buildFeatureRows, comparePooled, forwardOpenReturn, type ModelScore, type Sample } from "./logistic";
import { conviction, ewmaVolatility, targetVolatility } from "./volatility";
import type { SymbolSnapshot } from "@/lib/market/types";

export interface BarNote {
  gap: string | null;
  momentum: string | null;
  opening: string | null;
  noise: string | null;
  bvc: string | null;
  size: string | null;
}

export interface TrackRecord {
  trials: number;
  deflatedSharpe: number;
  adopted: boolean;
  reason: string;
  modelLogLoss: number | null;
  baseLogLoss: number | null;
  legacyLogLoss: number | null;
  modelBrier: number | null;
  baseBrier: number | null;
  legacyBrier: number | null;
}

export interface Study {
  cells: Record<string, CellStats>;
  notes: Record<string, BarNote>;
  models: Partial<Record<Timeframe, ModelScore>>;
  track: TrackRecord;
}

export function cellKey(symbol: string, timeframe: Timeframe, direction: "bullish" | "bearish"): string {
  return `${symbol}|${timeframe}|${direction}`;
}

export function studySnapshots(snapshots: SymbolSnapshot[]): Study {
  const drafts: CellStats[] = [];
  const notes: Record<string, BarNote> = {};
  const byTimeframe = new Map<Timeframe, Sample[][]>();
  for (const snapshot of snapshots) {
    for (const timeframe of Object.keys(FORWARD_BARS) as Timeframe[]) {
      const bars = snapshot.bars[timeframe];
      if (!bars || bars.length < 50) continue;
      const calls = replayCalls(bars, timeframe);
      const prior = pooledRate(calls, timeframe);
      for (const direction of ["bullish", "bearish"] as const) {
        drafts.push(evaluateDirection({
          symbol: snapshot.quote.symbol,
          timeframe,
          direction,
          bars,
          calls,
          horizon: FORWARD_BARS[timeframe],
          priorMean: prior,
        }));
      }
      notes[`${snapshot.quote.symbol}|${timeframe}`] = notesFor(snapshot.quote.symbol, timeframe, bars, calls);
      const samples = samplesFor(bars, calls, timeframe, snapshot.quote.symbol);
      const group = byTimeframe.get(timeframe) ?? [];
      if (samples.length >= 80) group.push(samples);
      byTimeframe.set(timeframe, group);
    }
  }
  const cells: Record<string, CellStats> = {};
  for (const cell of applySignificance(drafts)) {
    cells[cellKey(cell.symbol, cell.timeframe, cell.direction)] = cell;
  }
  const models: Partial<Record<Timeframe, ModelScore>> = {};
  let adopted: ModelScore | null = null;
  for (const [timeframe, groups] of byTimeframe) {
    if (groups.length === 0) continue;
    const score = comparePooled(groups, FORWARD_BARS[timeframe]);
    models[timeframe] = score;
    if (!adopted || score.adopted) adopted = score;
  }
  const moments = sharpeMoments(Object.values(cells));
  const trials = Math.max(1, Object.keys(cells).length + Object.keys(models).length * 3);
  const dsr = deflatedSharpe({
    sharpe: moments.sharpe,
    trials,
    sharpeVariance: moments.variance,
    skew: moments.skew,
    kurtosis: moments.kurtosis,
    observations: Math.max(2, moments.observations),
  });
  const chosen = adopted ?? {
    adopted: false,
    reason: "Not enough history to fit the logistic combiner.",
    modelLogLoss: null,
    baseLogLoss: null,
    legacyLogLoss: null,
    modelBrier: null,
    baseBrier: null,
    legacyBrier: null,
    probabilityUp: null,
    lambdasTried: 3,
  };
  return {
    cells,
    notes,
    models,
    track: {
      trials,
      deflatedSharpe: dsr,
      adopted: chosen.adopted,
      reason: chosen.reason,
      modelLogLoss: chosen.modelLogLoss,
      baseLogLoss: chosen.baseLogLoss,
      legacyLogLoss: chosen.legacyLogLoss,
      modelBrier: chosen.modelBrier,
      baseBrier: chosen.baseBrier,
      legacyBrier: chosen.legacyBrier,
    },
  };
}

function pooledRate(calls: BarCall[], timeframe: Timeframe): number {
  void timeframe;
  const directional = calls.filter((call) => call.direction !== "neutral");
  if (directional.length === 0) return 0.5;
  return 0.5;
}

function samplesFor(bars: Bar[], calls: BarCall[], timeframe: Timeframe, symbol: string): Sample[] {
  const horizon = FORWARD_BARS[timeframe];
  const features = buildFeatureRows(bars, timeframe);
  const cost = costBpsPerSide(symbol, bars);
  const threshold = (2 * cost) / 10_000;
  const samples: Sample[] = [];
  for (let index = 40; index < bars.length - horizon - 1; index += 1) {
    const forward = forwardOpenReturn(bars, index, horizon);
    if (forward == null) continue;
    samples.push({
      x: features[index],
      y: forward > threshold ? 1 : 0,
      legacy: calls[index].direction === "bullish" ? calls[index].probability / 100 : calls[index].direction === "bearish" ? -calls[index].probability / 100 : 0,
    });
  }
  return samples;
}

function notesFor(symbol: string, timeframe: Timeframe, bars: Bar[], calls: BarCall[]): BarNote {
  const gap = timeframe === "1d" ? gapSplit(bars) : null;
  const momentum = timeframe === "1d" ? null : intradayMomentum(bars);
  const opening = timeframe === "1d" ? null : openingRange(bars);
  const noise = timeframe === "1d" ? null : noiseArea(bars);
  const flow = bvcImbalance(bars, bars.length - 1, 5);
  const vols = ewmaVolatility(bars, 20);
  const target = targetVolatility(vols);
  const edge = Math.max(...calls.slice(-5).map((call) => call.probability / 100), 0);
  const size = conviction(edge, vols.at(-1) ?? 0, target);
  return {
    gap: gap && gap.overnight20 != null && gap.intraday20 != null
      ? `20-day overnight sum ${(gap.overnight20 * 100).toFixed(2)}%, intraday sum ${(gap.intraday20 * 100).toFixed(2)}%.`
      : timeframe === "1d" ? "Gap split needs more daily bars." : null,
    momentum: momentum?.detail ?? null,
    opening: opening?.detail ?? null,
    noise: noise?.detail ?? null,
    bvc: `Signed volume imbalance over 5 bars is ${flow.toFixed(2)}.`,
    size: `Suggested size: ${Math.round(size * 100)}% of normal.`,
  };
}
