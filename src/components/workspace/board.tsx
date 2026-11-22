"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { decodeLayout, encodeLayout, type LayoutPanel } from "@/lib/workspace/layout";

const KEY = "tradehax.workspace";
const CHOICES = [
  { id: "flow", href: "/flow/", label: "Flow tape" },
  { id: "tide", href: "/tide/", label: "Tide" },
  { id: "gamma", href: "/gex/", label: "Gamma" },
  { id: "chart", href: "/chart/", label: "Chart" },
  { id: "screener", href: "/screener/", label: "Screener" },
  { id: "strategy", href: "/strategy/", label: "Strategy" },
  { id: "vol", href: "/vol/", label: "IV table" },
  { id: "portfolio", href: "/portfolio/", label: "Portfolio" },
  { id: "offex", href: "/offex/", label: "Off-exchange" },
];

export function WorkspaceBoard() {
  const [panels, setPanels] = useState<LayoutPanel[]>([
    { id: "chart", cols: 2, rows: 1 },
    { id: "flow", cols: 1, rows: 1 },
  ]);
  const [name, setName] = useState("desk");
  const loaded = useRef(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#layout=/, "");
    if (window.location.hash.startsWith("#layout=")) {
      const shared = decodeLayout(hash);
      if (shared) {
        window.setTimeout(() => {
          setPanels(shared.panels);
          setName(shared.name);
        }, 0);
      }
    }
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { panels?: LayoutPanel[]; name?: string };
          if (parsed.panels) setPanels(parsed.panels);
          if (parsed.name) setName(parsed.name);
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
    window.localStorage.setItem(KEY, JSON.stringify({ panels, name }));
  }, [panels, name]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((choice) => (
          <Button key={choice.id} type="button" size="sm" variant={panels.some((panel) => panel.id === choice.id) ? "default" : "outline"} onClick={() => setPanels(panels.some((panel) => panel.id === choice.id) ? panels.filter((panel) => panel.id !== choice.id) : [...panels, { id: choice.id, cols: 1, rows: 1 }])}>
            {choice.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {panels.map((panel, index) => {
          const choice = CHOICES.find((item) => item.id === panel.id);
          if (!choice) return null;
          return (
            <section key={panel.id} className={`rounded-xl bg-card/80 p-3 ring-1 ring-foreground/10 ${panel.cols === 2 ? "md:col-span-2" : ""}`} style={{ gridRow: `span ${panel.rows}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{choice.label}</h2>
                <div className="flex gap-1">
                  <Button type="button" size="xs" variant="outline" onClick={() => move(index, -1)}>Up</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => move(index, 1)}>Down</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => setPanels(panels.map((item) => item.id === panel.id ? { ...item, cols: item.cols === 2 ? 1 : 2 } : item))}>{panel.cols === 2 ? "Narrow" : "Wide"}</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => { window.location.hash = `layout=${encodeLayout({ name, panels })}`; }}>Share</Button>
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
