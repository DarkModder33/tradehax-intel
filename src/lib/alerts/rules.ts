import type { FlowPrint } from "@/lib/flow/classify";
import { daysToExpiry, isOtm } from "@/lib/flow/tape";

export interface AlertRule {
  id: string;
  ticker: string;
  minPremium: number;
  side: "any" | "ASK" | "BID";
  flag: "any" | "sweep" | "block";
  maxDte: number | null;
  otm: boolean;
  /** Cannot be confirmed from a print that has no open interest. Those prints do not match. */
  volOverOi: boolean;
  minScore?: number | null;
}

export interface AlertHit {
  id: string;
  ruleId: string;
  at: string;
  summary: string;
}

export function matchesRule(print: FlowPrint, rule: AlertRule, now: Date, spot?: number, openInterest?: number): boolean {
  if (rule.ticker && print.root !== rule.ticker.toUpperCase()) return false;
  if (print.premium < rule.minPremium) return false;
  if (rule.side !== "any" && print.side !== rule.side) return false;
  if (rule.flag !== "any" && !print.flags.includes(rule.flag)) return false;
  if (rule.maxDte != null && daysToExpiry(print.expiry, now) > rule.maxDte) return false;
  if (rule.otm && isOtm(print, spot) !== true) return false;
  if (rule.minScore != null && (print.score ?? 0) < rule.minScore) return false;
  if (rule.volOverOi) {
    if (openInterest == null) return false;
    if (!(print.size > openInterest)) return false;
  }
  return true;
}

export function newHits(prints: FlowPrint[], rules: AlertRule[], seen: Set<string>, now: Date): AlertHit[] {
  const hits: AlertHit[] = [];
  for (const print of prints) {
    for (const rule of rules) {
      if (!matchesRule(print, rule, now)) continue;
      const id = `${rule.id}|${print.contract}|${print.time}|${print.size}`;
      if (seen.has(id)) continue;
      seen.add(id);
      hits.push({
        id,
        ruleId: rule.id,
        at: print.time,
        summary: `${print.root} ${print.right} ${print.strike} ${print.side} $${Math.round(print.premium)}`,
      });
    }
  }
  return hits;
}
