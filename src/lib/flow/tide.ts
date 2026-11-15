import type { FlowPrint } from "./classify.ts";

export interface TideBar {
  netCallPremium: number;
  netPutPremium: number;
  netVolume: number;
}

/** Ask minus bid premium. Mid prints and small or deep-in-the-money prints are left out. */
export function tideBar(prints: FlowPrint[], minPremium = 1000): TideBar {
  let callAsk = 0;
  let callBid = 0;
  let putAsk = 0;
  let putBid = 0;
  let callAskVol = 0;
  let callBidVol = 0;
  let putAskVol = 0;
  let putBidVol = 0;
  for (const print of prints) {
    if (print.side === "MID" || print.premium < minPremium || Math.abs(print.delta) > 0.9) continue;
    if (print.right === "call" && print.side === "ASK") {
      callAsk += print.premium;
      callAskVol += print.size;
    } else if (print.right === "call" && print.side === "BID") {
      callBid += print.premium;
      callBidVol += print.size;
    } else if (print.right === "put" && print.side === "ASK") {
      putAsk += print.premium;
      putAskVol += print.size;
    } else if (print.right === "put" && print.side === "BID") {
      putBid += print.premium;
      putBidVol += print.size;
    }
  }
  return {
    netCallPremium: callAsk - callBid,
    netPutPremium: putAsk - putBid,
    netVolume: callAskVol - callBidVol - (putAskVol - putBidVol),
  };
}

export function topNetImpact(prints: FlowPrint[]): { symbol: string; net: number }[] {
  const totals = new Map<string, number>();
  for (const print of prints) {
    const bar = tideBar([print]);
    totals.set(print.root, (totals.get(print.root) ?? 0) + bar.netCallPremium - bar.netPutPremium);
  }
  return [...totals.entries()]
    .map(([symbol, net]) => ({ symbol, net }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}
