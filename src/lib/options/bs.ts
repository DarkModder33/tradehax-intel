import { normalCdf } from "@/lib/stats/normal";

export interface BsInput {
  spot: number;
  strike: number;
  timeYears: number;
  sigma: number;
  rate?: number;
  dividend?: number;
  right: "call" | "put";
}

function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function yearFraction(expiry: string, asOf: Date): number {
  const end = Date.parse(`${expiry}T21:00:00Z`);
  const years = (end - asOf.getTime()) / (365 * 24 * 60 * 60 * 1000);
  return Number.isFinite(years) ? Math.max(0, years) : 0;
}

export function bsTerms(input: BsInput): { d1: number; d2: number } | null {
  const rate = input.rate ?? 0;
  const dividend = input.dividend ?? 0;
  if (input.spot <= 0 || input.strike <= 0 || input.timeYears <= 0 || input.sigma <= 0) return null;
  const volTime = input.sigma * Math.sqrt(input.timeYears);
  const d1 = (Math.log(input.spot / input.strike) + (rate - dividend + 0.5 * input.sigma * input.sigma) * input.timeYears) / volTime;
  return { d1, d2: d1 - volTime };
}

export function bsPrice(input: BsInput): number {
  const intrinsic = input.right === "call" ? Math.max(0, input.spot - input.strike) : Math.max(0, input.strike - input.spot);
  const terms = bsTerms(input);
  if (!terms) return intrinsic;
  const rate = input.rate ?? 0;
  const dividend = input.dividend ?? 0;
  const discount = Math.exp(-rate * input.timeYears);
  const carry = Math.exp(-dividend * input.timeYears);
  if (input.right === "call") return input.spot * carry * normalCdf(terms.d1) - input.strike * discount * normalCdf(terms.d2);
  return input.strike * discount * normalCdf(-terms.d2) - input.spot * carry * normalCdf(-terms.d1);
}

/** ∂V/∂σ, in price per 1.00 of volatility (not per vol point). */
export function bsVega(input: BsInput): number {
  const terms = bsTerms(input);
  if (!terms) return 0;
  const dividend = input.dividend ?? 0;
  return input.spot * Math.exp(-dividend * input.timeYears) * pdf(terms.d1) * Math.sqrt(input.timeYears);
}

/** Black-Scholes theta in price points per day. */
export function bsTheta(input: BsInput): number {
  const terms = bsTerms(input);
  if (!terms) return 0;
  const rate = input.rate ?? 0;
  const dividend = input.dividend ?? 0;
  const discount = Math.exp(-rate * input.timeYears);
  const carry = Math.exp(-dividend * input.timeYears);
  const common = -(input.spot * carry * pdf(terms.d1) * input.sigma) / (2 * Math.sqrt(input.timeYears));
  const carryTerm = input.right === "call"
    ? dividend * input.spot * carry * normalCdf(terms.d1) - rate * input.strike * discount * normalCdf(terms.d2)
    : -dividend * input.spot * carry * normalCdf(-terms.d1) + rate * input.strike * discount * normalCdf(-terms.d2);
  return (common + carryTerm) / 365;
}

export function bsDelta(input: BsInput): number {
  const terms = bsTerms(input);
  if (!terms) return input.right === "call" ? (input.spot > input.strike ? 1 : 0) : input.spot < input.strike ? -1 : 0;
  const dividend = input.dividend ?? 0;
  const forward = Math.exp(-dividend * input.timeYears) * normalCdf(terms.d1);
  return input.right === "call" ? forward : forward - Math.exp(-dividend * input.timeYears);
}

export function bsGamma(input: BsInput): number {
  const terms = bsTerms(input);
  if (!terms) return 0;
  const dividend = input.dividend ?? 0;
  return (Math.exp(-dividend * input.timeYears) * pdf(terms.d1)) / (input.spot * input.sigma * Math.sqrt(input.timeYears));
}

/** ∂Δ/∂σ. The same expression applies to calls and puts. */
export function bsVanna(input: BsInput): number {
  const terms = bsTerms(input);
  if (!terms) return 0;
  const dividend = input.dividend ?? 0;
  return (-Math.exp(-dividend * input.timeYears) * pdf(terms.d1) * terms.d2) / input.sigma;
}

/** −∂Δ/∂t, in delta points per day. */
export function bsCharm(input: BsInput): number {
  const day = 1 / 365;
  if (input.timeYears <= day) return 0;
  const now = bsDelta(input);
  const later = bsDelta({ ...input, timeYears: input.timeYears - day });
  return -(later - now);
}
