import type { ChainSnapshot } from "@/lib/sources/cboe";
import { buildExposure, heatmap, type GammaLevels, type StrikeExposure } from "./exposure";
import { expectedMove, type ExpectedMove } from "./expectedMove";
import { termStructure, type TermPoint } from "./iv";
import { maxPain } from "./maxpain";

export interface ChainSummary {
  symbol: string;
  spot: number;
  asOf: string | null;
  source: string;
  delay: string;
  iv30: number | null;
  maxPain: number | null;
  levels: GammaLevels;
  expectedMove: (ExpectedMove & { low: number; high: number }) | null;
  term: TermPoint[];
  /** Slope of ATM IV from the front expiry to the expiry nearest 60 days, in vol points. */
  termSlope: number | null;
  near: StrikeExposure[];
  heatmap: { expiry: string; strike: number; netGex: number }[];
}

function frontExpiry(chain: ChainSnapshot, asOf: Date): string | null {
  const upcoming = [...new Set(chain.contracts.map((contract) => contract.expiry))]
    .filter((expiry) => Date.parse(`${expiry}T21:00:00Z`) >= asOf.getTime())
    .sort();
  return upcoming[0] ?? null;
}

/** Compact gamma book. The full chain stays on the worker. */
export function summarizeChain(chain: ChainSnapshot, asOf: Date, source = chain.source): ChainSummary {
  const book = buildExposure(chain, asOf);
  const expiry = frontExpiry(chain, asOf);
  const move = expiry ? expectedMove(chain.contracts, chain.spot, expiry) : null;
  const term = termStructure(chain.contracts, chain.spot, asOf).filter((point) => point.iv != null).slice(0, 12);
  const front = term.find((point) => point.dte >= 0);
  const back = term.filter((point) => point.dte >= 45 && point.dte <= 90).sort((a, b) => Math.abs(a.dte - 60) - Math.abs(b.dte - 60))[0];
  const termSlope = front?.iv != null && back?.iv != null ? back.iv - front.iv : null;
  const near = book.byStrike.filter((row) => chain.spot > 0 && Math.abs(row.strike - chain.spot) / chain.spot <= 0.04);
  const cells = heatmap(chain, 0.05);
  const expiries = [...new Set(cells.map((cell) => cell.expiry))].slice(0, 6);
  return {
    symbol: chain.symbol,
    spot: chain.spot,
    asOf: chain.asOf,
    source,
    delay: chain.delay,
    iv30: chain.iv30,
    maxPain: maxPain(chain.contracts),
    levels: book.levels,
    expectedMove: move ? { ...move, low: chain.spot - move.dollars, high: chain.spot + move.dollars } : null,
    term,
    termSlope,
    near,
    heatmap: cells.filter((cell) => expiries.includes(cell.expiry)),
  };
}
