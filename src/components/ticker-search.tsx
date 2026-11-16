"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tickerPath } from "@/lib/ticker/route";

export function TickerSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return (
      <button type="button" className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground" onClick={() => setOpen(true)}>
        Search
      </button>
    );
  }

  return (
    <form
      className="flex gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        const symbol = draft.trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) return;
        setOpen(false);
        setDraft("");
        router.push(tickerPath(symbol));
      }}
    >
      <label className="sr-only" htmlFor="ticker-search">Ticker</label>
      <input
        id="ticker-search"
        autoFocus
        value={draft}
        placeholder="Ticker"
        onChange={(event) => setDraft(event.target.value.toUpperCase())}
        className="h-7 w-28 rounded-md border border-border bg-card px-2 font-mono text-xs uppercase"
      />
    </form>
  );
}
