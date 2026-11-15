import type { ChainContract, ChainSnapshot } from "@/lib/sources/cboe";
import { bsCharm, bsGamma, bsVanna, yearFraction } from "./bs";

export interface StrikeExposure {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
  dex: number;
  vex: number;
  chex: number;
}

export interface ExpiryExposure {
  expiry: string;
  netGex: number;
  dex: number;
  vex: number;
  chex: number;
}

export interface GammaLevels {
  netGex: number;
  dex: number;
  vex: number;
  chex: number;
  callWall: number | null;
  putWall: number | null;
  magnet: number | null;
  flip: number | null;
  flips: number[];
  regime: "dealer long gamma" | "dealer short gamma" | "flat";
}

export interface ExposureBook {
  byStrike: StrikeExposure[];
  byExpiry: ExpiryExposure[];
  levels: GammaLevels;
}

const MULTIPLIER = 100;

export function contractGex(contract: ChainContract, spot: number): number {
  const sign = contract.right === "call" ? 1 : -1;
  return sign * contract.gamma * contract.openInterest * MULTIPLIER * spot * spot * 0.01;
}

export function contractDex(contract: ChainContract, spot: number): number {
  return contract.delta * contract.openInterest * MULTIPLIER * spot;
}

export function buildExposure(chain: ChainSnapshot, asOf: Date): ExposureBook {
  const spot = chain.spot;
  const strikes = new Map<number, StrikeExposure>();
  const expiries = new Map<string, ExpiryExposure>();
  let netGex = 0;
  let dex = 0;
  let vex = 0;
  let chex = 0;

  for (const contract of chain.contracts) {
    const gex = contractGex(contract, spot);
    const dexRow = contractDex(contract, spot);
    const sigma = contract.iv;
    const time = yearFraction(contract.expiry, asOf);
    const sign = contract.right === "call" ? 1 : -1;
    const input = { spot, strike: contract.strike, timeYears: time, sigma, right: contract.right };
    const vanna = sigma > 0 && time > 0 ? bsVanna(input) : 0;
    const charm = sigma > 0 && time > 0 ? bsCharm(input) : 0;
    const vexRow = sign * vanna * contract.openInterest * MULTIPLIER * spot * sigma;
    const chexRow = sign * charm * contract.openInterest * MULTIPLIER * spot;
    netGex += gex;
    dex += dexRow;
    vex += vexRow;
    chex += chexRow;

    const strike = strikes.get(contract.strike) ?? {
      strike: contract.strike,
      callGex: 0,
      putGex: 0,
      netGex: 0,
      dex: 0,
      vex: 0,
      chex: 0,
    };
    if (contract.right === "call") strike.callGex += Math.abs(gex);
    else strike.putGex += Math.abs(gex);
    strike.netGex += gex;
    strike.dex += dexRow;
    strike.vex += vexRow;
    strike.chex += chexRow;
    strikes.set(contract.strike, strike);

    const expiry = expiries.get(contract.expiry) ?? { expiry: contract.expiry, netGex: 0, dex: 0, vex: 0, chex: 0 };
    expiry.netGex += gex;
    expiry.dex += dexRow;
    expiry.vex += vexRow;
    expiry.chex += chexRow;
    expiries.set(contract.expiry, expiry);
  }

  const byStrike = [...strikes.values()].sort((a, b) => a.strike - b.strike);
  const callWall = byStrike.filter((row) => row.strike > spot).sort((a, b) => b.callGex - a.callGex)[0]?.strike ?? null;
  const putWall = byStrike.filter((row) => row.strike < spot).sort((a, b) => b.putGex - a.putGex)[0]?.strike ?? null;
  const magnet = byStrike.slice().sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex))[0]?.strike ?? null;
  const flip = gammaFlips(chain, asOf);

  return {
    byStrike,
    byExpiry: [...expiries.values()].sort((a, b) => a.expiry.localeCompare(b.expiry)),
    levels: {
      netGex,
      dex,
      vex,
      chex,
      callWall,
      putWall,
      magnet,
      flip: flip.primary,
      flips: flip.all,
      regime: netGex > 0 ? "dealer long gamma" : netGex < 0 ? "dealer short gamma" : "flat",
    },
  };
}

/** Reprice gamma on a spot grid and find where dealer net gamma crosses zero. */
export interface HeatCell {
  expiry: string;
  strike: number;
  netGex: number;
}

export function heatmap(chain: ChainSnapshot, band = 0.05): HeatCell[] {
  const cells = new Map<string, HeatCell>();
  for (const contract of chain.contracts) {
    if (Math.abs(contract.strike - chain.spot) / chain.spot > band) continue;
    const key = `${contract.expiry}|${contract.strike}`;
    const cell = cells.get(key) ?? { expiry: contract.expiry, strike: contract.strike, netGex: 0 };
    cell.netGex += contractGex(contract, chain.spot);
    cells.set(key, cell);
  }
  return [...cells.values()];
}

export function gammaFlips(chain: ChainSnapshot, asOf: Date, step = 0.0025): { primary: number | null; all: number[] } {
  const spots: number[] = [];
  const nets: number[] = [];
  for (let ratio = 0.85; ratio <= 1.15001; ratio += step) {
    const spot = chain.spot * ratio;
    let net = 0;
    for (const contract of chain.contracts) {
      const time = yearFraction(contract.expiry, asOf);
      const gamma = contract.iv > 0 && time > 0
        ? bsGamma({ spot, strike: contract.strike, timeYears: time, sigma: contract.iv, right: contract.right })
        : 0;
      const sign = contract.right === "call" ? 1 : -1;
      net += sign * gamma * contract.openInterest * 100 * spot * spot * 0.01;
    }
    spots.push(spot);
    nets.push(net);
  }
  const crosses: number[] = [];
  for (let i = 1; i < nets.length; i++) {
    if (nets[i - 1] === 0) crosses.push(spots[i - 1]);
    else if (nets[i - 1] * nets[i] < 0) {
      const weight = Math.abs(nets[i - 1]) / (Math.abs(nets[i - 1]) + Math.abs(nets[i]));
      crosses.push(spots[i - 1] + (spots[i] - spots[i - 1]) * weight);
    }
  }
  const primary = crosses.slice().sort((a, b) => Math.abs(a - chain.spot) - Math.abs(b - chain.spot))[0] ?? null;
  return { primary, all: crosses.slice(0, 5) };
}
