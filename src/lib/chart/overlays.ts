import type { FlowPrint } from "@/lib/flow/classify";
import type { ChainSummary } from "@/lib/options/summary";

export interface PriceLineSpec {
  price: number;
  title: string;
  color: string;
}

export interface FlowMarkerSpec {
  time: number;
  price: number;
  color: string;
  size: number;
  text: string;
  tooltip: string;
  inferred: boolean;
}

const BULL = "#61da92";
const BEAR = "#f97676";
const GOLD = "#ebc669";

export function gexPriceLines(summary: ChainSummary): PriceLineSpec[] {
  const lines: PriceLineSpec[] = [];
  const add = (price: number | null | undefined, title: string, color: string) => {
    if (price == null || !Number.isFinite(price)) return;
    lines.push({ price, title, color });
  };
  add(summary.levels.callWall, `Call wall ${summary.levels.callWall}`, BULL);
  add(summary.levels.putWall, `Put wall ${summary.levels.putWall}`, BEAR);
  add(summary.levels.flip, `Gamma flip ${summary.levels.flip?.toFixed(2)}`, GOLD);
  add(summary.maxPain, `Max pain ${summary.maxPain}`, "#9bb0c7");
  if (summary.expectedMove) {
    add(summary.expectedMove.high, `+1σ ${summary.expectedMove.high.toFixed(2)}`, BULL);
    add(summary.expectedMove.low, `−1σ ${summary.expectedMove.low.toFixed(2)}`, BEAR);
  }
  return lines;
}

export function markerSize(premium: number): number {
  if (premium >= 5_000_000) return 3;
  if (premium >= 1_000_000) return 2;
  if (premium >= 250_000) return 1.4;
  return 1;
}

/** Green is ask-side calls and bid-side puts. Red is the other way around. */
export function flowMarkerColor(print: Pick<FlowPrint, "right" | "side">): string | null {
  const bullish = (print.right === "call" && print.side === "ASK") || (print.right === "put" && print.side === "BID");
  const bearish = (print.right === "call" && print.side === "BID") || (print.right === "put" && print.side === "ASK");
  if (bullish) return BULL;
  if (bearish) return BEAR;
  return null;
}

export function flowMarkers(prints: FlowPrint[]): FlowMarkerSpec[] {
  const markers: FlowMarkerSpec[] = [];
  for (const print of prints) {
    const color = flowMarkerColor(print);
    if (!color) continue;
    const time = Date.parse(print.time);
    if (!Number.isFinite(time)) continue;
    const inferred = print.inferred ? " · INFERRED" : "";
    markers.push({
      time,
      price: print.strike,
      color,
      size: markerSize(print.premium),
      text: print.contract,
      tooltip: `${print.contract} · $${Math.round(print.premium).toLocaleString("en-US")} · ${print.side}${inferred}`,
      inferred: print.inferred,
    });
  }
  return markers.sort((a, b) => a.time - b.time);
}

export function offexLines(prints: { price: number; notional: number }[]): PriceLineSpec[] {
  return prints
    .filter((print) => print.notional >= 1_000_000 && print.price > 0)
    .slice(0, 8)
    .map((print) => ({
      price: print.price,
      title: `Off-ex $${(print.notional / 1e6).toFixed(1)}M`,
      color: "#90bce9",
    }));
}
