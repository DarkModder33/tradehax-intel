export const SCORE_WEIGHTS = {
  premium: 0.22,
  volumeOi: 0.16,
  ask: 0.12,
  sweep: 0.14,
  otm: 0.14,
  repeat: 0.12,
  earnings: 0.1,
} as const;

export interface ScoreInput {
  premium: number;
  medianPremium: number;
  volume: number;
  openInterest: number;
  askSide: boolean;
  sweep: boolean;
  otmFraction: number;
  dte: number;
  repeats: number;
  daysToEarnings: number | null;
}

export interface ScoreBreakdown {
  score: number;
  status: "scored" | "building";
  parts: Record<keyof typeof SCORE_WEIGHTS, number>;
}

function clip01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Clipped z-style factor in 0..1. A zero scale returns 0 so a flat history does not explode. */
export function clippedFactor(value: number, scale: number): number {
  if (!(scale > 0) || !Number.isFinite(value)) return 0;
  const z = Math.max(-3, Math.min(3, value / scale));
  return (z + 3) / 6;
}

export function unusualScore(input: ScoreInput, historyPoints = 20): ScoreBreakdown {
  const premium = clippedFactor(Math.log1p(input.premium) - Math.log1p(Math.max(0, input.medianPremium)), 1.2);
  const volOi = input.openInterest > 0 ? clip01(input.volume / input.openInterest / 4) : 0;
  const ask = input.askSide ? 1 : 0;
  const sweep = input.sweep ? 1 : 0;
  const otm = clip01(input.otmFraction) * clip01(1 - Math.min(input.dte, 30) / 30);
  const repeat = clip01(input.repeats / 4);
  const earnings = input.daysToEarnings == null ? 0 : clip01(1 - Math.min(Math.max(input.daysToEarnings, 0), 10) / 10);
  const parts = { premium, volumeOi: volOi, ask, sweep, otm, repeat, earnings };
  const score = Math.round(
    100 * (parts.premium * SCORE_WEIGHTS.premium
      + parts.volumeOi * SCORE_WEIGHTS.volumeOi
      + parts.ask * SCORE_WEIGHTS.ask
      + parts.sweep * SCORE_WEIGHTS.sweep
      + parts.otm * SCORE_WEIGHTS.otm
      + parts.repeat * SCORE_WEIGHTS.repeat
      + parts.earnings * SCORE_WEIGHTS.earnings),
  );
  return { score: Math.max(0, Math.min(100, score)), status: historyPoints >= 20 ? "scored" : "building", parts };
}

export function scoreDeciles<T extends { score: number; forward: number }>(rows: T[]): { decile: number; n: number; average: number }[] {
  if (!rows.length) return [];
  const sorted = rows.slice().sort((a, b) => a.score - b.score);
  const size = Math.ceil(sorted.length / 10);
  const out = [];
  for (let decile = 0; decile < 10; decile += 1) {
    const slice = sorted.slice(decile * size, (decile + 1) * size);
    if (!slice.length) continue;
    const average = slice.reduce((sum, row) => sum + row.forward, 0) / slice.length;
    out.push({ decile: decile + 1, n: slice.length, average });
  }
  return out;
}
