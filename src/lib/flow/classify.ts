export type Side = "ASK" | "BID" | "MID";
export type Right = "call" | "put";

export interface FlowPrint {
  time: string;
  contract: string;
  root: string;
  expiry: string;
  strike: number;
  right: Right;
  side: Side;
  size: number;
  price: number;
  premium: number;
  delta: number;
  exchange?: string;
  conditions: string[];
  inferred: boolean;
  sentiment: "bullish" | "bearish" | "neutral";
  flags: string[];
  score?: number;
  scoreStatus?: "scored" | "building";
}

export function inferSide(price: number, bid: number, ask: number): Side {
  if (!(ask > bid) || !(price > 0)) return "MID";
  const spread = ask - bid;
  if (price >= ask - 0.25 * spread) return "ASK";
  if (price <= bid + 0.25 * spread) return "BID";
  return "MID";
}

export function sentiment(right: Right, side: Side): FlowPrint["sentiment"] {
  if ((right === "call" && side === "ASK") || (right === "put" && side === "BID")) return "bullish";
  if ((right === "call" && side === "BID") || (right === "put" && side === "ASK")) return "bearish";
  return "neutral";
}

export function isBlock(size: number, premium: number): boolean {
  return size >= 100 || premium >= 100_000;
}

export function isOffExchange(exchange: string | undefined): boolean {
  return exchange === "D";
}

/** ISO condition, or the same side on two exchanges within 500 ms. */
export function sweepIds(prints: FlowPrint[]): Set<string> {
  const hits = new Set<string>();
  const groups = new Map<string, FlowPrint[]>();
  for (const print of prints) {
    if (print.conditions.some((code) => code.toUpperCase().includes("ISO"))) hits.add(printKey(print));
    const bucket = groups.get(print.contract) ?? [];
    bucket.push(print);
    groups.set(print.contract, bucket);
  }
  for (const bucket of groups.values()) {
    const ordered = bucket.slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    for (let i = 0; i < ordered.length; i++) {
      const exchanges = new Set<string>();
      if (ordered[i].exchange) exchanges.add(ordered[i].exchange as string);
      for (let j = i + 1; j < ordered.length; j++) {
        if (Date.parse(ordered[j].time) - Date.parse(ordered[i].time) > 500) break;
        if (ordered[j].side !== ordered[i].side || ordered[j].side === "MID") continue;
        const exchange = ordered[j].exchange;
        if (exchange) exchanges.add(exchange);
      }
      if (exchanges.size >= 2) hits.add(printKey(ordered[i]));
    }
  }
  return hits;
}

function printKey(print: FlowPrint): string {
  return `${print.contract}|${print.time}|${print.exchange ?? ""}|${print.size}`;
}

export function withFlags(prints: FlowPrint[]): FlowPrint[] {
  const sweeps = sweepIds(prints);
  return prints.map((print) => {
    const flags = [...print.flags];
    if (sweeps.has(printKey(print))) flags.push("sweep");
    if (isBlock(print.size, print.premium)) flags.push("block");
    if (isOffExchange(print.exchange)) flags.push("off-exchange");
    if (print.inferred) flags.push("inferred");
    return { ...print, flags: [...new Set(flags)] };
  });
}
