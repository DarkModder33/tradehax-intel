import { SYMBOL_SECTOR } from "@/lib/market/context";
import { usEquitySession } from "@/lib/market/session";
import type { FlowPrint } from "./classify.ts";
import { tideBar } from "./tide.ts";

export const ETFS = new Set(["SPY", "QQQ", "IWM", "DIA"]);

export interface TapeFilter {
  minPremium: number;
  right: "all" | "call" | "put";
  sweepsOnly: boolean;
  ticker: string;
  maxDte: number | null;
  otmOnly: boolean;
  unusual: boolean;
  spots: Record<string, number>;
}

export const OPEN_FILTER: TapeFilter = {
  minPremium: 0,
  right: "all",
  sweepsOnly: false,
  ticker: "",
  maxDte: null,
  otmOnly: false,
  unusual: false,
  spots: {},
};

export function daysToExpiry(expiry: string, now: Date): number {
  const end = Date.parse(`${expiry}T21:00:00Z`);
  return (end - now.getTime()) / 86_400_000;
}

export function isOtm(print: FlowPrint, spot: number | undefined): boolean | null {
  if (spot == null || spot <= 0) return null;
  return print.right === "call" ? print.strike > spot : print.strike < spot;
}

/** Unusual preset we can apply without open interest: size, premium, short dated, ask side, single leg, and out of the money when spot is known. */
export function isUnusual(print: FlowPrint, now: Date, spot: number | undefined): boolean {
  if (print.premium < 10_000 || print.size < 5) return false;
  if (print.flags.includes("multileg") || print.side !== "ASK") return false;
  if (daysToExpiry(print.expiry, now) > 60) return false;
  const otm = isOtm(print, spot);
  return otm !== false;
}

export function passesTapeFilter(print: FlowPrint, filter: TapeFilter, now: Date): boolean {
  if (print.premium < filter.minPremium) return false;
  if (filter.right !== "all" && print.right !== filter.right) return false;
  if (filter.sweepsOnly && !print.flags.includes("sweep")) return false;
  if (filter.ticker && print.root !== filter.ticker.toUpperCase()) return false;
  if (filter.maxDte != null && daysToExpiry(print.expiry, now) > filter.maxDte) return false;
  const spot = filter.spots[print.root];
  if (filter.otmOnly && isOtm(print, spot) !== true) return false;
  if (filter.unusual && !isUnusual(print, now, spot)) return false;
  return true;
}

export function printKey(print: FlowPrint): string {
  return `${print.contract}|${print.time}|${print.size}|${print.exchange ?? ""}|${print.price}`;
}

export function mergePrints(existing: FlowPrint[], incoming: FlowPrint[], limit = 2000): FlowPrint[] {
  const seen = new Set(existing.map(printKey));
  const next = existing.slice();
  for (const print of incoming) {
    const key = printKey(print);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(print);
  }
  next.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return next.slice(-limit);
}

export interface TidePoint {
  time: string;
  call: number;
  put: number;
  net: number;
}

export function cumulativeTide(prints: FlowPrint[], bucketMs = 60_000): TidePoint[] {
  const buckets = new Map<number, FlowPrint[]>();
  for (const print of prints) {
    const stamp = Date.parse(print.time);
    if (!Number.isFinite(stamp)) continue;
    const bucket = Math.floor(stamp / bucketMs) * bucketMs;
    const group = buckets.get(bucket) ?? [];
    group.push(print);
    buckets.set(bucket, group);
  }
  let call = 0;
  let put = 0;
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([stamp, group]) => {
      const bar = tideBar(group);
      call += bar.netCallPremium;
      put += bar.netPutPremium;
      return { time: new Date(stamp).toISOString(), call, put, net: call - put };
    });
}

export function sectorTide(prints: FlowPrint[]): { name: string; net: number }[] {
  const totals = new Map<string, number>();
  for (const print of prints) {
    const name = ETFS.has(print.root) ? "ETF" : (SYMBOL_SECTOR[print.root] ?? "Other");
    const bar = tideBar([print]);
    totals.set(name, (totals.get(name) ?? 0) + bar.netCallPremium - bar.netPutPremium);
  }
  return [...totals.entries()].map(([name, net]) => ({ name, net })).sort((a, b) => b.net - a.net);
}

export interface PriceLevel {
  price: number;
  shares: number;
  notional: number;
}

export function priceLevels(prints: { price: number; size: number }[], band = 0.001): PriceLevel[] {
  const buckets = new Map<number, PriceLevel>();
  for (const print of prints) {
    if (print.price <= 0) continue;
    const price = Math.round(print.price / (print.price * band)) * (print.price * band);
    const key = Number(price.toFixed(4));
    const level = buckets.get(key) ?? { price: key, shares: 0, notional: 0 };
    level.shares += print.size;
    level.notional += print.price * print.size;
    buckets.set(key, level);
  }
  return [...buckets.values()].sort((a, b) => b.notional - a.notional);
}

export function connectionLabel(input: { online: boolean; streaming: boolean; sessionOpen: boolean }): "live" | "delayed 15m" | "offline" {
  if (!input.online) return "offline";
  if (input.streaming && input.sessionOpen) return "live";
  return "delayed 15m";
}

export function lastSessionReplay(prints: FlowPrint[], now: Date): boolean {
  if (usEquitySession(now).status === "open") return false;
  return prints.length > 0;
}
