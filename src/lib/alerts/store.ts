import type { AlertHit, AlertRule } from "./rules";

export const LISTS_KEY = "tradehax.lists";
export const RULES_KEY = "tradehax.alert-rules";
export const LOG_KEY = "tradehax.alert-log";

const listeners = new Set<() => void>();

function write(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
  for (const listener of listeners) listener();
}

export function subscribeAlerts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const defaultLists: Record<string, string[]> = { Main: ["SPY", "NVDA"] };
let listsCache: { raw: string; value: Record<string, string[]> } = { raw: "", value: defaultLists };

export function getLists(): Record<string, string[]> {
  if (typeof window === "undefined") return defaultLists;
  const raw = window.localStorage.getItem(LISTS_KEY) ?? "";
  if (raw === listsCache.raw) return listsCache.value;
  listsCache = { raw, value: raw ? (JSON.parse(raw) as Record<string, string[]>) : defaultLists };
  return listsCache.value;
}
export function getServerLists(): Record<string, string[]> {
  return defaultLists;
}
export function setLists(lists: Record<string, string[]>) {
  write(LISTS_KEY, lists);
}

const emptyRules: AlertRule[] = [];
let rulesCache = { raw: "", value: emptyRules };

export function getRules(): AlertRule[] {
  if (typeof window === "undefined") return emptyRules;
  const raw = window.localStorage.getItem(RULES_KEY) ?? "";
  if (raw === rulesCache.raw) return rulesCache.value;
  rulesCache = { raw, value: raw ? (JSON.parse(raw) as AlertRule[]) : emptyRules };
  return rulesCache.value;
}
export function getServerRules(): AlertRule[] {
  return emptyRules;
}
export function setRules(rules: AlertRule[]) {
  write(RULES_KEY, rules);
}

const emptyLog: AlertHit[] = [];
let logCache = { raw: "", value: emptyLog };

export function getLog(): AlertHit[] {
  if (typeof window === "undefined") return emptyLog;
  const raw = window.localStorage.getItem(LOG_KEY) ?? "";
  if (raw === logCache.raw) return logCache.value;
  logCache = { raw, value: raw ? (JSON.parse(raw) as AlertHit[]) : emptyLog };
  return logCache.value;
}
export function getServerLog(): AlertHit[] {
  return emptyLog;
}
export function setLog(log: AlertHit[]) {
  write(LOG_KEY, log.slice(0, 100));
}
