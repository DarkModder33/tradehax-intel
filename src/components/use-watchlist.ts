"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_WATCHLIST, sanitizeSymbols } from "@/lib/market/symbols";

const STORAGE_KEY = "tradehax.watchlist";
const DEFAULT_SNAPSHOT: string[] = [...DEFAULT_WATCHLIST];

let snapshot: string[] = DEFAULT_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function readStored(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return sanitizeSymbols(parsed.map(String));
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (!loaded) {
    loaded = true;
    const stored = readStored();
    if (stored && stored.join(",") !== DEFAULT_SNAPSHOT.join(",")) snapshot = stored;
  }
  return snapshot;
}

function getServerSnapshot() {
  return DEFAULT_SNAPSHOT;
}

export function useWatchlist() {
  const symbols = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setSymbols = useCallback((next: string[]) => {
    snapshot = sanitizeSymbols(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    emit();
  }, []);
  return [symbols, setSymbols] as const;
}
