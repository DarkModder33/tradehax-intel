import { describeAgreement } from "@/lib/indicators/agreement";
import { TIMEFRAME_LABEL, type Direction, type Factor, type Signal } from "@/lib/indicators/types";
import { directionClass, directionLabel, formatChange, formatPrice } from "@/lib/format";
import type { Quote } from "@/lib/market/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Sparkline({ values, direction }: { values: number[]; direction: Direction }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 112;
  const height = 36;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke =
    direction === "bullish"
      ? "var(--bullish)"
      : direction === "bearish"
        ? "var(--bearish)"
        : "var(--muted-foreground)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function VoteBar({ score }: { score: number }) {
  const width = `${Math.abs(score) * 50}%`;
  const bullish = score >= 0;
  return (
    <div className="relative h-1.5 rounded-full bg-foreground/10" aria-hidden="true">
      <div className="absolute top-0 left-1/2 h-full w-px bg-foreground/25" />
      <div
        className={cn("absolute top-0 h-full rounded-full", bullish ? "bg-bullish" : "bg-bearish")}
        style={bullish ? { left: "50%", width } : { left: `calc(50% - ${width})`, width }}
      />
    </div>
  );
}

function FactorRow({ factor }: { factor: Factor }) {
  return (
    <li className="grid grid-cols-1 gap-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <div className="flex items-baseline justify-between gap-3 sm:block">
        <p className="text-xs font-medium">{factor.label}</p>
        <p className={cn("text-[11px] tracking-wide uppercase", directionClass(factor.direction))}>
          {directionLabel(factor.direction)}
        </p>
      </div>
      <div className="min-w-0">
        <VoteBar score={factor.score} />
        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{factor.detail}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {Math.round(factor.weight * 100)}% of the model
        </p>
      </div>
    </li>
  );
}

export function SignalCard({
  signal,
  quote,
  peers,
  selected,
  onSelect,
  history,
  regimeNote,
}: {
  signal: Signal;
  quote: Quote | undefined;
  peers: Signal[];
  selected: boolean;
  onSelect: () => void;
  history: string | null;
  regimeNote: string | null;
}) {
  const agreement = describeAgreement(peers);
  const change = quote?.changePercent ?? null;
  const price = quote?.price ?? signal.price;

  return (
    <Card
      id={`signal-${signal.symbol}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${signal.symbol} on ${TIMEFRAME_LABEL[signal.timeframe]}, ${directionLabel(signal.direction)}, ${signal.probability} percent confidence`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-pointer bg-card/85 text-left shadow-none transition hover:bg-card focus-visible:ring-2 focus-visible:ring-gold/70",
        selected && "ring-2 ring-gold/70",
      )}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight">{signal.symbol}</h3>
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {TIMEFRAME_LABEL[signal.timeframe]}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm">
              {formatPrice(price)}{" "}
              <span className={change == null ? "text-muted-foreground" : change >= 0 ? "text-bullish" : "text-bearish"}>
                {formatChange(change)}
              </span>
            </p>
          </div>
          <Sparkline values={signal.trail} direction={signal.direction} />
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <p className={cn("text-sm font-medium tracking-wide uppercase", directionClass(signal.direction))}>
              {directionLabel(signal.direction)}
            </p>
            <p className="font-serif text-4xl leading-none tracking-tight">
              {signal.probability}
              <span className="text-xl text-muted-foreground">%</span>
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={cn(
                "h-full rounded-full",
                signal.direction === "bullish" && "bg-bullish",
                signal.direction === "bearish" && "bg-bearish",
                signal.direction === "neutral" && "bg-muted-foreground/50",
              )}
              style={{ width: `${signal.probability}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Model confidence
          </p>
        </div>

        {history ? <p className="text-sm leading-relaxed text-foreground/95">{history}</p> : null}
        {regimeNote ? <p className="text-sm leading-relaxed text-gold">{regimeNote}</p> : null}

        <p className="font-serif text-[15px] leading-relaxed text-foreground/95">{signal.summary}</p>

        <p className={cn("text-xs", directionClass(agreement.direction))}>{agreement.label}</p>

        {signal.factors.length > 0 ? (
          <ul className="flex flex-col gap-3 border-t border-border/80 pt-3">
            {signal.factors.map((factor) => (
              <FactorRow key={factor.id} factor={factor} />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
