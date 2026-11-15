"use client";

import { useEffect, useState } from "react";
import { fetchChain, type ChainSnapshot } from "@/lib/sources/cboe";

export function useChain(symbol: string) {
  const [chain, setChain] = useState<ChainSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    fetchChain(symbol)
      .then((next) => {
        if (stopped) return;
        setChain(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (stopped) return;
        setChain(null);
        setError(err instanceof Error ? err.message : "The chain did not load.");
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [symbol]);

  return { chain, error, loading };
}

export function readSymbol(fallback = "SPY"): string {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get("s");
  return value && /^[A-Z][A-Z0-9.]{0,9}$/i.test(value) ? value.toUpperCase() : fallback;
}
