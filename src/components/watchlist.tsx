"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { Direction } from "@/lib/indicators/types";
import { directionClass, formatChange, formatPrice } from "@/lib/format";
import type { Quote, SymbolError } from "@/lib/market/types";
import { MAX_SYMBOLS, normalizeSymbol } from "@/lib/market/symbols";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface WatchHint {
  direction: Direction | "split";
  text: string;
}

export function Watchlist({
  symbols,
  quotes,
  errors,
  hints,
  selected,
  onSelect,
  onAdd,
  onRemove,
}: {
  symbols: string[];
  quotes: Quote[];
  errors: SymbolError[];
  hints: Record<string, WatchHint | undefined>;
  selected: string | null;
  onSelect: (symbol: string | null) => void;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const full = symbols.length >= MAX_SYMBOLS;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const symbol = normalizeSymbol(draft);
    if (!symbol) {
      setFormError("Use a ticker like NVDA or BRK.B.");
      return;
    }
    if (symbols.includes(symbol)) {
      setFormError(`${symbol} is already on the list.`);
      onSelect(symbol);
      setDraft("");
      return;
    }
    if (full) {
      setFormError(`The watchlist holds ${MAX_SYMBOLS} names.`);
      return;
    }
    setFormError(null);
    setDraft("");
    onAdd(symbol);
  };

  const quoteFor = (symbol: string) => quotes.find((quote) => quote.symbol === symbol);
  const errorFor = (symbol: string) => errors.find((error) => error.symbol === symbol);

  return (
    <div className="flex flex-col gap-3 md:h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Watchlist</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {symbols.length}/{MAX_SYMBOLS}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        <Chip pressed={selected === null} onClick={() => onSelect(null)}>
          All
        </Chip>
        {symbols.map((symbol) => (
          <Chip
            key={symbol}
            pressed={selected === symbol}
            onClick={() => onSelect(symbol)}
            onRemove={() => onRemove(symbol)}
            removeLabel={`Remove ${symbol}`}
          >
            <span className={cn("mr-1.5 inline-block size-1.5 rounded-full bg-current", directionClass(hints[symbol]?.direction ?? "neutral"))} />
            {symbol}
          </Chip>
        ))}
      </div>

      <div className="hidden min-h-0 flex-1 md:block">
        <ScrollArea className="h-[calc(100dvh-15rem)] pr-3">
          <div className="flex flex-col gap-1">
            <RowButton pressed={selected === null} onClick={() => onSelect(null)} label="All names" detail="Ranked feed" />
            {symbols.map((symbol) => {
              const quote = quoteFor(symbol);
              const hint = hints[symbol];
              const problem = errorFor(symbol);
              return (
                <div key={symbol} className="group relative">
                  <RowButton
                    pressed={selected === symbol}
                    onClick={() => onSelect(symbol)}
                    label={symbol}
                    detail={
                      problem
                        ? "No data"
                        : quote
                          ? `${formatPrice(quote.price)}  ${formatChange(quote.changePercent)}`
                          : "Waiting"
                    }
                    hint={hint?.text}
                    hintClass={directionClass(hint?.direction ?? "neutral")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-2 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    aria-label={`Remove ${symbol}`}
                    onClick={() => onRemove(symbol)}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          aria-label="Add ticker"
          placeholder={full ? "List is full" : "Add ticker"}
          value={draft}
          disabled={full}
          onChange={(event) => {
            setDraft(event.target.value.toUpperCase());
            if (formError) setFormError(null);
          }}
          className="uppercase"
          maxLength={10}
        />
        <Button type="submit" disabled={full}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </form>
      {formError ? <p className="text-xs text-bearish">{formError}</p> : null}
    </div>
  );
}

function Chip({
  children,
  pressed,
  onClick,
  onRemove,
  removeLabel = "Remove ticker",
}: {
  children: ReactNode;
  pressed: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full ring-1 ring-foreground/15",
        pressed ? "bg-gold/15 text-gold ring-gold/40" : "bg-card/70 text-foreground",
      )}
    >
      <button type="button" aria-pressed={pressed} onClick={onClick} className="py-1 pr-1 pl-3 text-sm">
        {children}
      </button>
      {onRemove ? (
        <button type="button" aria-label={removeLabel} onClick={onRemove} className="py-1 pr-2 pl-1 text-muted-foreground">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

function RowButton({
  label,
  detail,
  hint,
  hintClass,
  pressed,
  onClick,
}: {
  label: string;
  detail: string;
  hint?: string;
  hintClass?: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 pr-8 text-left ring-1 ring-transparent transition hover:bg-foreground/5",
        pressed && "bg-gold/10 ring-gold/30",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">{detail}</span>
      </span>
      {hint ? <span className={cn("shrink-0 font-mono text-[11px]", hintClass)}>{hint}</span> : null}
    </button>
  );
}
