"use client";

import { useEffect, useState } from "react";
import type { FlowPrint } from "@/lib/flow/classify";
import { connectionLabel, lastSessionReplay, mergePrints } from "@/lib/flow/tape";
import { usEquitySession } from "@/lib/market/session";
import { workerConnected, workerUrl } from "@/lib/live/worker";

export interface OffexPrint {
  time: string;
  symbol: string;
  price: number;
  size: number;
  notional: number;
  exchange: string;
  conditions: string[];
}

export interface FlowAlert {
  rule: string;
  contract: string;
  count: number;
  premium: number;
}

export function useWorkerFeed() {
  const base = workerUrl();
  const connected = workerConnected();
  const [prints, setPrints] = useState<FlowPrint[]>([]);
  const [offex, setOffex] = useState<OffexPrint[]>([]);
  const [alerts, setAlerts] = useState<FlowAlert[]>([]);
  const [online, setOnline] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    let stopped = false;
    const pull = async () => {
      try {
        const [flowRes, alertRes, offexRes] = await Promise.all([
          fetch(`${base}/v1/flow?limit=2000`),
          fetch(`${base}/v1/alerts`),
          fetch(`${base}/v1/offex?limit=400`),
        ]);
        if (!flowRes.ok) throw new Error(`Flow feed returned ${flowRes.status}`);
        const flow = await flowRes.json();
        const alertBody = alertRes.ok ? await alertRes.json() : { alerts: [] };
        const offexBody = offexRes.ok ? await offexRes.json() : { prints: [] };
        if (stopped) return;
        setPrints(flow.prints ?? []);
        setAlerts(alertBody.alerts ?? []);
        setOffex(offexBody.prints ?? []);
        setOnline(true);
        setError(null);
      } catch (err) {
        if (stopped) return;
        setOnline(false);
        setError(err instanceof Error ? err.message : "The worker did not answer.");
      }
    };
    void pull();
    const timer = window.setInterval(pull, 20_000);
    const source = new EventSource(`${base}/v1/stream`);
    source.addEventListener("hello", (event) => {
      const body = JSON.parse((event as MessageEvent).data);
      if (stopped) return;
      setPrints(body.prints ?? []);
      setOnline(true);
      setStreaming(true);
    });
    source.addEventListener("prints", (event) => {
      const body = JSON.parse((event as MessageEvent).data);
      if (stopped) return;
      setPrints((current) => mergePrints(current, body.prints ?? []));
      if (Array.isArray(body.offex) && body.offex.length) {
        setOffex((current) => [...body.offex, ...current].slice(0, 400));
      }
      setStreaming(true);
      setOnline(true);
    });
    source.onerror = () => {
      if (!stopped) setStreaming(false);
    };
    return () => {
      stopped = true;
      window.clearInterval(timer);
      source.close();
    };
  }, [base, connected]);

  const sessionOpen = usEquitySession(new Date()).status === "open";
  return {
    base,
    connected,
    prints,
    offex,
    alerts,
    online,
    streaming,
    error,
    status: connectionLabel({ online: connected && online, streaming, sessionOpen }),
    replay: lastSessionReplay(prints, new Date()),
  };
}
