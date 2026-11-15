"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDashboard } from "@/lib/market/dashboard";
import type { DashboardPayload } from "@/lib/market/types";

export const DASHBOARD_POLL_MS = 25_000;

export function useDashboard(symbolKey: string, enabled: boolean, stayAwake = false) {
  const [packet, setPacket] = useState<{ key: string; payload: DashboardPayload } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !symbolKey) return;

    let stopped = false;
    let requestId = 0;

    const pull = async (initial: boolean) => {
      const id = ++requestId;
      if (!initial) setRefreshing(true);
      try {
        const symbols = symbolKey.split(",").filter(Boolean);
        const payload = await loadDashboard(symbols);
        if (stopped || id !== requestId) return;
        setPacket({ key: symbolKey, payload });
        setFailure(null);
      } catch (err) {
        if (stopped) return;
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
      if (!stayAwake && document.visibilityState !== "visible") return;
      void pull(false);
    }, DASHBOARD_POLL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled, symbolKey, reloadKey, stayAwake]);

  return {
    data: packet?.key === symbolKey ? packet.payload : null,
    error: failure?.key === symbolKey ? failure.message : null,
    refreshing,
    reload,
  };
}
