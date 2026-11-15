import { describeAgreement } from "@/lib/indicators/agreement";
import { TIMEFRAME_LABEL, TIMEFRAMES, type Signal, type Timeframe } from "@/lib/indicators/types";
import { directionClass, directionLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TimeframeBoard({
  symbols,
  signals,
  selected,
  onSelect,
  onOpen,
}: {
  symbols: string[];
  signals: Signal[];
  selected: string | null;
  onSelect: (symbol: string) => void;
  onOpen: (symbol: string, timeframe: Timeframe) => void;
}) {
  if (symbols.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {symbols.map((symbol) => {
        const mine = signals.filter((signal) => signal.symbol === symbol);
        const agreement = describeAgreement(mine);
        return (
          <article
            key={symbol}
            className={cn(
              "rounded-2xl bg-card/85 p-3 ring-1 ring-foreground/10 md:p-4",
              selected === symbol && "ring-gold/70",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelect(symbol)}
                className="text-base font-semibold tracking-tight hover:text-gold"
              >
                {symbol}
              </button>
              <p className={cn("text-xs", directionClass(agreement.direction))}>{agreement.label}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TIMEFRAMES.map((timeframe) => {
                const signal = mine.find((item) => item.timeframe === timeframe);
                const direction = signal?.direction ?? "neutral";
                return (
                  <button
                    key={timeframe}
                    type="button"
                    onClick={() => onOpen(symbol, timeframe)}
                    aria-label={
                      signal
                        ? `${symbol} ${TIMEFRAME_LABEL[timeframe]}, ${directionLabel(direction)}, ${signal.probability} percent confidence`
                        : `${symbol} ${TIMEFRAME_LABEL[timeframe]} unavailable`
                    }
                    className="rounded-xl bg-foreground/5 px-2 py-2 text-left ring-1 ring-transparent transition hover:ring-foreground/15"
                  >
                    <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      {TIMEFRAME_LABEL[timeframe]}
                    </span>
                    <span className={cn("mt-1 block font-mono text-sm", directionClass(direction))}>
                      {signal ? `${signal.probability}%` : "n/a"}
                    </span>
                    <span className={cn("block text-[11px]", directionClass(direction))}>
                      {signal ? directionLabel(direction) : "No data"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">{agreement.narrative}</p>
          </article>
        );
      })}
    </div>
  );
}
