import type { AlertRule } from "./rules";
import type { FlowPrint } from "@/lib/flow/classify";
import { matchesRule } from "./rules";

export interface PushPayload {
  title: string;
  body: string;
  ruleId: string;
  symbol: string;
}

export function pushConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(env.VAPID_PUBLIC && env.VAPID_PRIVATE && env.VAPID_SUBJECT && env.CF_KV_NAMESPACE_ID && env.CF_API_TOKEN && env.CF_ACCOUNT_ID);
}

export function matchingPushes(prints: FlowPrint[], rules: AlertRule[], now: Date): PushPayload[] {
  const payloads: PushPayload[] = [];
  for (const print of prints) {
    for (const rule of rules) {
      if (!matchesRule(print, rule, now)) continue;
      payloads.push({
        title: `${print.root} ${print.right} ${print.strike}`,
        body: `${print.side} premium ${Math.round(print.premium)}`,
        ruleId: rule.id,
        symbol: print.root,
      });
    }
  }
  return payloads;
}

export function allowPush(recent: { key: string; at: number }[], key: string, now: number, windowMs = 5 * 60_000): { allowed: boolean; next: { key: string; at: number }[] } {
  const fresh = recent.filter((item) => now - item.at < windowMs);
  if (fresh.some((item) => item.key === key)) return { allowed: false, next: fresh };
  return { allowed: true, next: [...fresh, { key, at: now }] };
}

export function dropOnGone(status: number): boolean {
  return status === 410 || status === 404;
}
