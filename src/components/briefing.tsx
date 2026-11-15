import { TIMEFRAME_LABEL, TIMEFRAMES, type Signal, type Timeframe } from "@/lib/indicators/types";
import type { Agreement } from "@/lib/indicators/agreement";
import { directionClass, directionLabel, formatChange, formatPrice } from "@/lib/format";
import type { HeadlineResult } from "@/lib/market/context";
import type { Quote } from "@/lib/market/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Briefing({
  symbol,
  quote,
  agreement,
  signals,
  active,
  onTimeframe,
  onClear,
  headlines,
}: {
  symbol: string;
  quote: Quote | undefined;
  agreement: Agreement;
  signals: Signal[];
  active: Timeframe | "board";
  onTimeframe: (timeframe: Timeframe) => void;
  onClear: () => void;
  headlines: HeadlineResult | undefined;
}) {
  const change = quote?.changePercent ?? null;
  return (
    <section className="rounded-2xl bg-card/80 p-4 ring-1 ring-foreground/10 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-gold uppercase">Briefing</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{symbol}</h2>
          <p className="mt-1 font-mono text-sm">
            {quote ? formatPrice(quote.price) : "No price"}{" "}
            <span className={change == null ? "text-muted-foreground" : change >= 0 ? "text-bullish" : "text-bearish"}>
              {formatChange(change)}
            </span>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          All names
        </Button>
      </div>
      <p className="mt-4 font-serif text-xl leading-snug text-foreground md:text-2xl">{agreement.narrative}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TIMEFRAMES.map((timeframe) => {
          const signal = signals.find((item) => item.timeframe === timeframe);
          const direction = signal?.direction ?? "neutral";
          const pressed = active === timeframe;
          return (
            <button
              key={timeframe}
              type="button"
              aria-pressed={pressed}
              onClick={() => onTimeframe(timeframe)}
              className={cn(
                "rounded-xl px-2 py-2 text-left ring-1 ring-foreground/10 transition hover:bg-foreground/5",
                pressed && "ring-gold/70",
              )}
            >
              <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {TIMEFRAME_LABEL[timeframe]}
              </span>
              <span className={cn("mt-1 block text-sm font-medium", directionClass(direction))}>
                {signal ? directionLabel(direction) : "n/a"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {signal ? `${signal.probability}%` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <Headlines result={headlines} />
    </section>
  );
}

function Headlines({ result }: { result: HeadlineResult | undefined }) {
  if (!result) return null;
  if (result.status === "unavailable") {
    return <p className="mt-4 text-sm text-muted-foreground">Headlines unavailable for {result.symbol}.</p>;
  }
  if (result.items.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No headlines came back for {result.symbol}.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {result.items.map((item) => (
        <li key={item.title} className="text-sm leading-relaxed">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="underline decoration-foreground/30 underline-offset-2">
              {item.title}
            </a>
          ) : (
            item.title
          )}
          <span className="text-muted-foreground"> · {item.publisher}</span>
        </li>
      ))}
    </ul>
  );
}
