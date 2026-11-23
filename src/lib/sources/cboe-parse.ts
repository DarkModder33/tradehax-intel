import { isStandardContract, parseOcc, type OccContract } from "./occ";

export interface ChainContract extends OccContract {
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  theo: number;
  openInterest: number;
  volume: number;
  last: number;
  lastTradeTime: string | null;
}

export interface ChainSnapshot {
  symbol: string;
  spot: number;
  iv30: number | null;
  asOf: string | null;
  volume: number | null;
  contracts: ChainContract[];
  source: "Cboe delayed" | "Alpaca indicative" | "Yahoo options";
  delay: string;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseCboeChain(payload: unknown, root: string): ChainSnapshot {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const symbol = String(data.symbol ?? root).toUpperCase();
  const options = Array.isArray(data.options) ? data.options : [];
  const contracts: ChainContract[] = [];
  for (const row of options) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const option = String(raw.option ?? "");
    if (!isStandardContract(option, symbol)) continue;
    const parsed = parseOcc(option);
    if (!parsed) continue;
    contracts.push({
      ...parsed,
      bid: num(raw.bid),
      ask: num(raw.ask),
      iv: num(raw.iv),
      delta: num(raw.delta),
      gamma: num(raw.gamma),
      vega: num(raw.vega),
      theta: num(raw.theta),
      rho: num(raw.rho),
      theo: num(raw.theo),
      openInterest: num(raw.open_interest),
      volume: num(raw.volume),
      last: num(raw.last_trade_price),
      lastTradeTime: typeof raw.last_trade_time === "string" ? raw.last_trade_time : null,
    });
  }
  return {
    symbol,
    spot: num(data.current_price),
    iv30: typeof data.iv30 === "number" ? data.iv30 : null,
    asOf: typeof body.timestamp === "string" ? body.timestamp : null,
    volume: typeof data.volume === "number" ? data.volume : null,
    contracts,
    source: "Cboe delayed",
    delay: "about 15 min",
  };
}
