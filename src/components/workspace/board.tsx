"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { openFallbackWindow } from "@/lib/popout/pip";

const KEY = "tradehax.workspace";
const CHOICES = [
  { id: "flow", href: "/flow/", label: "Flow tape" },
  { id: "tide", href: "/tide/", label: "Tide" },
  { id: "gamma", href: "/gex/", label: "Gamma" },
  { id: "offex", href: "/offex/", label: "Off-exchange" },
];

export function WorkspaceBoard() {
  const [panels, setPanels] = useState<string[]>(["flow", "tide"]);
  const [wide, setWide] = useState<Record<string, boolean>>({});
  const loaded = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { panels?: string[]; wide?: Record<string, boolean> };
          if (parsed.panels) setPanels(parsed.panels);
          if (parsed.wide) setWide(parsed.wide);
        } catch {
          // Keep the default layout.
        }
      }
      loaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    window.localStorage.setItem(KEY, JSON.stringify({ panels, wide }));
  }, [panels, wide]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((choice) => (
          <Button key={choice.id} type="button" size="sm" variant={panels.includes(choice.id) ? "default" : "outline"} onClick={() => setPanels(panels.includes(choice.id) ? panels.filter((id) => id !== choice.id) : [...panels, choice.id])}>
            {choice.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {panels.map((id, index) => {
          const choice = CHOICES.find((item) => item.id === id);
          if (!choice) return null;
          return (
            <section key={id} className={`rounded-xl bg-card/80 p-3 ring-1 ring-foreground/10 ${wide[id] ? "md:col-span-2" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{choice.label}</h2>
                <div className="flex gap-1">
                  <Button type="button" size="xs" variant="outline" onClick={() => move(index, -1)}>Up</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => move(index, 1)}>Down</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => setWide({ ...wide, [id]: !wide[id] })}>{wide[id] ? "Narrow" : "Wide"}</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => openFallbackWindow({ symbols: ["SPY"], timeframe: "5m", sound: false })}>Pop out</Button>
                </div>
              </div>
              <a className="mt-2 inline-block text-sm text-gold" href={choice.href}>Open {choice.label}</a>
            </section>
          );
        })}
      </div>
    </div>
  );

  function move(index: number, delta: number) {
    const next = panels.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setPanels(next);
  }
}
