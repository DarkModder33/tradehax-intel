"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/components/use-dashboard";
import { POPOUT_CHANNEL, readPopoutMessage, snapshotCovers, snapshotIsFresh } from "@/lib/popout/channel";
import type { DashboardPayload } from "@/lib/market/types";

export function usePopoutFeed(symbols: string[]) {
  const symbolKey = symbols.join(",");
  const [remote, setRemote] = useState<{ sentAt: number; payload: DashboardPayload } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(POPOUT_CHANNEL);
    const onMessage = (event: MessageEvent) => {
      const message = readPopoutMessage(event.data);
      if (message?.type === "snapshot") setRemote({ sentAt: message.sentAt, payload: message.payload });
    };
    channel.addEventListener("message", onMessage);
    return () => channel.close();
  }, []);

  const following =
    remote != null && snapshotCovers(remote.payload, symbols) && snapshotIsFresh(remote.sentAt, now);
  const own = useDashboard(symbolKey, symbols.length > 0 && !following, true);

  return {
    data: following ? remote.payload : own.data,
    error: following ? null : own.error,
    refreshing: following ? false : own.refreshing,
    reload: own.reload,
    following,
    now,
  };
}
