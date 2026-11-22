export const CHART_THEME = {
  bull: "var(--bullish)",
  bear: "var(--bearish)",
  gold: "var(--gold)",
  grid: "rgba(255,255,255,0.08)",
  font: "var(--font-geist-mono), ui-monospace, monospace",
} as const;

export function linePath(values: number[], width: number, height: number, pad = 2): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - pad * 2) - pad;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
