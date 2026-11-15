import { ema } from "@/lib/indicators/ema";
import { macd } from "@/lib/indicators/macd";
import { rsi } from "@/lib/indicators/rsi";
import type { Bar, Timeframe } from "@/lib/indicators/types";
import { walkForwardFolds } from "@/lib/stats/walkforward";
import { bvcImbalance } from "./features/bvc";
import { atr, ewmaVolatility } from "./volatility";

export interface Sample {
  x: number[];
  y: number;
  legacy: number;
}

export interface ModelScore {
  adopted: boolean;
  reason: string;
  modelLogLoss: number | null;
  baseLogLoss: number | null;
  legacyLogLoss: number | null;
  modelBrier: number | null;
  baseBrier: number | null;
  legacyBrier: number | null;
  probabilityUp: number | null;
  lambdasTried: number;
}

const LAMBDAS = [0.3, 3, 30];

export function buildFeatureRows(bars: Bar[], timeframe: Timeframe): number[][] {
  const closes = bars.map((bar) => bar.close);
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  const macdSeries = macd(closes);
  const rsiSeries = rsi(closes, 14);
  const ranges = atr(bars, 14);
  const vol = ewmaVolatility(bars, 20);
  return bars.map((bar, index) => {
    const scale = ranges[index] && ranges[index]! > 0 ? ranges[index]! : Math.max(Math.abs(bar.close) * 0.01, 1e-6);
    const spread = fast[index] != null && slow[index] != null ? (fast[index]! - slow[index]!) / scale : 0;
    const histogram = macdSeries[index]?.histogram;
    const macdFeature = histogram == null ? 0 : histogram / scale;
    const rsiFeature = rsiSeries[index] == null ? 0 : (rsiSeries[index]! - 50) / 50;
    const anchor = trailingAnchor(bars, index);
    const vwapFeature = timeframe === "1d" || anchor == null || anchor === 0 ? 0 : (bar.close - anchor) / scale;
    const flow = bvcImbalance(bars, index, 5);
    const sigma = vol[index] > 0 ? vol[index] : 0.01;
    const scaled = (lag: number) => {
      if (index < lag || closes[index - lag] === 0) return 0;
      return (closes[index] / closes[index - lag] - 1) / (sigma * Math.sqrt(lag));
    };
    const trend = index >= 20 && closes[index - 20] !== 0 ? Math.sign(closes[index] / closes[index - 20] - 1) : 0;
    const hour = etHour(bar.time);
    return [
      spread,
      macdFeature,
      rsiFeature,
      vwapFeature,
      flow,
      scaled(4),
      scaled(16),
      scaled(64),
      rollingVolumeRatio(bars, index),
      trend,
      sigma,
      Math.sin((2 * Math.PI * hour) / 24),
      Math.cos((2 * Math.PI * hour) / 24),
    ];
  });
}

function trailingAnchor(bars: Bar[], index: number): number | null {
  let priceVolume = 0;
  let volume = 0;
  const start = Math.max(0, index - 19);
  for (let cursor = start; cursor <= index; cursor += 1) {
    if (bars[cursor].volume <= 0) continue;
    const typical = (bars[cursor].high + bars[cursor].low + bars[cursor].close) / 3;
    priceVolume += typical * bars[cursor].volume;
    volume += bars[cursor].volume;
  }
  return volume > 0 ? priceVolume / volume : null;
}

function rollingVolumeRatio(bars: Bar[], index: number): number {
  if (index < 20) return 1;
  let sum = 0;
  for (let cursor = index - 20; cursor < index; cursor += 1) sum += bars[cursor].volume;
  const average = sum / 20;
  return average > 0 ? bars[index].volume / average : 1;
}

function etHour(time: number): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(time));
  return Number(hour);
}

export function forwardOpenReturn(bars: Bar[], index: number, horizon: number): number | null {
  const entry = bars[index + 1]?.open;
  const exit = bars[index + 1 + horizon]?.open;
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || !entry) return null;
  return exit / entry - 1;
}

function sigmoid(value: number): number {
  if (value > 30) return 1;
  if (value < -30) return 0;
  return 1 / (1 + Math.exp(-value));
}

export function fitLogistic(rows: number[][], labels: number[], lambda: number): { weights: number[]; bias: number } {
  const width = rows[0]?.length ?? 0;
  const weights = new Array<number>(width).fill(0);
  let bias = 0;
  const steps = 30;
  const rate = 0.15;
  for (let step = 0; step < steps; step += 1) {
    const gradient = new Array<number>(width).fill(0);
    let biasGradient = 0;
    for (let row = 0; row < rows.length; row += 1) {
      let score = bias;
      for (let column = 0; column < width; column += 1) score += weights[column] * rows[row][column];
      const error = sigmoid(score) - labels[row];
      biasGradient += error;
      for (let column = 0; column < width; column += 1) gradient[column] += error * rows[row][column];
    }
    const scale = rows.length || 1;
    bias -= rate * (biasGradient / scale);
    for (let column = 0; column < width; column += 1) {
      weights[column] -= rate * (gradient[column] / scale + lambda * weights[column]);
    }
  }
  return { weights, bias };
}

export function predictLogistic(rows: number[][], model: { weights: number[]; bias: number }): number[] {
  return rows.map((row) => {
    let score = model.bias;
    for (let column = 0; column < model.weights.length; column += 1) score += model.weights[column] * row[column];
    return sigmoid(score);
  });
}

function standardize(train: number[][], test: number[][]): { train: number[][]; test: number[][] } {
  const width = train[0]?.length ?? 0;
  const means = new Array<number>(width).fill(0);
  const deviations = new Array<number>(width).fill(1);
  for (const row of train) {
    for (let column = 0; column < width; column += 1) means[column] += row[column];
  }
  for (let column = 0; column < width; column += 1) means[column] /= train.length || 1;
  for (const row of train) {
    for (let column = 0; column < width; column += 1) deviations[column] += (row[column] - means[column]) ** 2;
  }
  for (let column = 0; column < width; column += 1) deviations[column] = Math.sqrt(deviations[column] / (train.length || 1)) || 1;
  const map = (rows: number[][]) => rows.map((row) => row.map((value, column) => (value - means[column]) / deviations[column]));
  return { train: map(train), test: map(test) };
}

function logLoss(labels: number[], probabilities: number[]): number {
  const eps = 1e-6;
  let total = 0;
  for (let index = 0; index < labels.length; index += 1) {
    const p = Math.min(1 - eps, Math.max(eps, probabilities[index]));
    total += -(labels[index] * Math.log(p) + (1 - labels[index]) * Math.log(1 - p));
  }
  return total / (labels.length || 1);
}

function brier(labels: number[], probabilities: number[]): number {
  let total = 0;
  for (let index = 0; index < labels.length; index += 1) total += (probabilities[index] - labels[index]) ** 2;
  return total / (labels.length || 1);
}

export function compareModels(samples: Sample[], horizon: number): ModelScore {
  return comparePooled([samples], horizon);
}

export function comparePooled(groups: Sample[][], horizon: number): ModelScore {
  const empty: ModelScore = {
    adopted: false,
    reason: "Not enough out-of-sample labels to compare the logistic combiner.",
    modelLogLoss: null,
    baseLogLoss: null,
    legacyLogLoss: null,
    modelBrier: null,
    baseBrier: null,
    legacyBrier: null,
    probabilityUp: null,
    lambdasTried: LAMBDAS.length,
  };
  const usable = groups.filter((group) => group.length >= 80);
  if (usable.length === 0) return empty;
  const folds = usable.flatMap((group) => walkForwardFolds(group.length, { horizon, minTrain: 40, testSize: 20, embargo: horizon }).map((fold) => ({ group, fold })));
  if (folds.length === 0) return empty;
  const modelP: number[] = [];
  const baseP: number[] = [];
  const legacyP: number[] = [];
  const y: number[] = [];
  for (const { group, fold } of folds) {
    const train = fold.train.map((index) => group[index]).filter(Boolean);
    const test = fold.test.map((index) => group[index]).filter(Boolean);
    if (train.length < 30 || test.length === 0) continue;
    const lambda = chooseLambda(train);
    const model = fitStandardized(train.map((sample) => sample.x), train.map((sample) => sample.y), lambda);
    const legacy = fitStandardized(train.map((sample) => [sample.legacy]), train.map((sample) => sample.y), 0.1);
    const base = train.reduce((sum, sample) => sum + sample.y, 0) / train.length;
    modelP.push(...predictStandardized(train.map((sample) => sample.x), test.map((sample) => sample.x), model));
    legacyP.push(...predictStandardized(train.map((sample) => [sample.legacy]), test.map((sample) => [sample.legacy]), legacy));
    for (let index = 0; index < test.length; index += 1) {
      baseP.push(base);
      y.push(test[index].y);
    }
  }
  if (y.length < 30) return empty;
  const modelLogLoss = logLoss(y, modelP);
  const baseLogLoss = logLoss(y, baseP);
  const legacyLogLoss = logLoss(y, legacyP);
  const modelBrier = brier(y, modelP);
  const baseBrier = brier(y, baseP);
  const legacyBrier = brier(y, legacyP);
  const adopted = modelLogLoss < baseLogLoss && modelLogLoss < legacyLogLoss && modelBrier < baseBrier && modelBrier < legacyBrier;
  const longest = usable.reduce((best, group) => (group.length > best.length ? group : best));
  const latest = fitStandardized(longest.slice(0, -horizon).map((sample) => sample.x), longest.slice(0, -horizon).map((sample) => sample.y), LAMBDAS[1]);
  const probabilityUp = predictStandardized(
    longest.slice(0, -horizon).map((sample) => sample.x),
    [longest[longest.length - 1].x],
    latest,
  )[0];
  return {
    adopted,
    reason: adopted
      ? "Adopted: out-of-sample log-loss and Brier beat the base rate and the legacy vote."
      : "Not adopted: it did not beat both the base rate and the legacy vote out of sample.",
    modelLogLoss,
    baseLogLoss,
    legacyLogLoss,
    modelBrier,
    baseBrier,
    legacyBrier,
    probabilityUp,
    lambdasTried: LAMBDAS.length,
  };
}

function chooseLambda(train: Sample[]): number {
  const cut = Math.max(20, Math.floor(train.length * 0.8));
  const fitRows = train.slice(0, cut);
  const holdRows = train.slice(cut);
  if (holdRows.length < 5) return LAMBDAS[1];
  let best = LAMBDAS[0];
  let bestLoss = Infinity;
  for (const lambda of LAMBDAS) {
    const model = fitStandardized(fitRows.map((sample) => sample.x), fitRows.map((sample) => sample.y), lambda);
    const predicted = predictStandardized(fitRows.map((sample) => sample.x), holdRows.map((sample) => sample.x), model);
    const loss = logLoss(holdRows.map((sample) => sample.y), predicted);
    if (loss < bestLoss) {
      bestLoss = loss;
      best = lambda;
    }
  }
  return best;
}

function fitStandardized(train: number[][], labels: number[], lambda: number) {
  const { train: rows } = standardize(train, train);
  return { ...fitLogistic(rows, labels, lambda), train };
}

function predictStandardized(train: number[][], test: number[][], model: { weights: number[]; bias: number; train: number[][] }): number[] {
  const scaled = standardize(model.train, test);
  return predictLogistic(scaled.test, model);
}
