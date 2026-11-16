import type { FlowPrint } from "./classify.ts";

export function hotByPremium(prints: FlowPrint[], limit = 15): { symbol: string; premium: number }[] {
  const totals = new Map<string, number>();
  for (const print of prints) totals.set(print.root, (totals.get(print.root) ?? 0) + print.premium);
  return [...totals.entries()]
    .map(([symbol, premium]) => ({ symbol, premium }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, limit);
}
