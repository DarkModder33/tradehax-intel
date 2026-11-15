import type { FlowPrint } from "./classify";

export interface FlowAlert {
  rule: string;
  contract: string;
  count: number;
  premium: number;
}

export function repeatedHits(prints: FlowPrint[], minCount = 5, minPremium = 10_000): FlowAlert[] {
  const groups = new Map<string, FlowPrint[]>();
  for (const print of prints) {
    const bucket = groups.get(print.contract) ?? [];
    bucket.push(print);
    groups.set(print.contract, bucket);
  }
  const alerts: FlowAlert[] = [];
  for (const [contract, bucket] of groups) {
    const ordered = bucket.slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    for (let start = 0; start < ordered.length; start++) {
      const window = [ordered[start]];
      for (let next = start + 1; next < ordered.length; next++) {
        if (Date.parse(ordered[next].time) - Date.parse(ordered[start].time) > 100) break;
        window.push(ordered[next]);
      }
      const premium = window.reduce((sum, print) => sum + print.premium, 0);
      if (window.length > minCount && premium > minPremium) {
        alerts.push({ rule: "RepeatedHits", contract, count: window.length, premium });
        break;
      }
    }
  }
  return alerts;
}

export function intervalUnusual(print: FlowPrint, dayVolume: number): boolean {
  if (dayVolume <= 0) return false;
  const askHeavy = print.side === "ASK";
  return print.size >= 0.5 * dayVolume && print.premium >= 100_000 && askHeavy;
}
