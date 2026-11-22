import type { Direction } from "@/lib/indicators/types";
import { CHART_THEME, linePath } from "./theme";

export function LineChart({
  values,
  direction = "neutral",
  className = "h-9 w-28",
  label,
}: {
  values: number[];
  direction?: Direction;
  className?: string;
  label?: string;
}) {
  if (values.length < 2) return null;
  const stroke = direction === "bullish" ? CHART_THEME.bull : direction === "bearish" ? CHART_THEME.bear : CHART_THEME.gold;
  return (
    <svg viewBox="0 0 112 36" className={className} role="img" aria-label={label ?? "Price trail"}>
      <path d={linePath(values, 112, 36)} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function AreaChart({
  series,
  className = "h-36 w-full",
  label = "Area chart",
}: {
  series: { values: number[]; color: string }[];
  className?: string;
  label?: string;
}) {
  const flat = series.flatMap((item) => item.values);
  if (flat.length < 2) return null;
  return (
    <svg viewBox="0 0 100 40" className={className} role="img" aria-label={label}>
      {series.map((item) => (
        <path key={item.color + item.values.length} d={linePath(item.values, 100, 40, 2)} fill="none" stroke={item.color} strokeWidth="0.8" />
      ))}
    </svg>
  );
}

export function HistogramChart({
  values,
  className = "h-16 w-full",
  label = "Histogram",
}: {
  values: number[];
  className?: string;
  label?: string;
}) {
  if (!values.length) return null;
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const width = 100 / values.length;
  return (
    <svg viewBox="0 0 100 40" className={className} role="img" aria-label={label}>
      {values.map((value, index) => {
        const height = (Math.abs(value) / max) * 18;
        const y = value >= 0 ? 20 - height : 20;
        return <rect key={index} x={index * width + 0.3} y={y} width={Math.max(0.4, width - 0.6)} height={Math.max(height, 0.4)} fill={value >= 0 ? CHART_THEME.bull : CHART_THEME.bear} />;
      })}
    </svg>
  );
}
