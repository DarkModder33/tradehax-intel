"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardPayload } from "@/lib/market/types";

const POLL_MS = 25_000;

export function useDashboard(symbolKey: string, enabled: boolean) {
  const [packet, setPacket] = useState<{ key: string; payload: DashboardPayload } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !symbolKey) return;

    const controller = new AbortController();
    let stopped = false;
    let requestId = 0;

    const pull = async (initial: boolean) => {
      const id = ++requestId;
      if (!initial) setRefreshing(true);
      try {
        const signal =
          typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function"
            ? AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)])
            : controller.signal;
        const response = await fetch(`/api/dashboard?symbols=${encodeURIComponent(symbolKey)}`, {
          cache: "no-store",
          signal,
        });
        const body = (await response.json().catch(() => null)) as
          | (DashboardPayload & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(body?.error || "The briefing could not be loaded.");
        }
        if (stopped || id !== requestId || !body) return;
        setPacket({ key: symbolKey, payload: body });
        setFailure(null);
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === "AbortError")) return;
        if (id !== requestId) return;
        const timedOut = err instanceof DOMException && err.name === "TimeoutError";
        setFailure({
          key: symbolKey,
          message: timedOut
            ? "The price source took too long. Try again."
            : err instanceof Error
              ? err.message
              : "The briefing could not be loaded.",
        });
      } finally {
        if (!stopped && id === requestId) setRefreshing(false);
      }
    };

    void pull(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void pull(false);
    }, POLL_MS);

    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, symbolKey, reloadKey]);

  return {
    data: packet?.key === symbolKey ? packet.payload : null,
    error: failure?.key === symbolKey ? failure.message : null,
    refreshing,
    reload,
  };
}
