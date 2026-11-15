"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SymbolForm({ symbol, onSubmit }: { symbol: string; onSubmit: (symbol: string) => void }) {
  const [draft, setDraft] = useState(symbol);
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = draft.trim().toUpperCase();
        if (!next) return;
        const url = new URL(window.location.href);
        url.searchParams.set("s", next);
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        onSubmit(next);
      }}
    >
      <label className="sr-only" htmlFor="chain-symbol">
        Symbol
      </label>
      <input
        id="chain-symbol"
        value={draft}
        onChange={(event) => setDraft(event.target.value.toUpperCase())}
        className="h-8 w-28 rounded-md border border-border bg-card px-2 font-mono text-sm uppercase"
      />
      <Button type="submit" size="sm" variant="outline">
        Load chain
      </Button>
    </form>
  );
}
