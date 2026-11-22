import { formatDigits } from "@/lib/format";
export function TideLines({ points }: { points: { call: number; put: number; net: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-muted-foreground">Not enough prints for a line yet.</p>;
  const values = points.flatMap((point) => [point.call, point.put, point.net]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = (pick: (point: (typeof points)[number]) => number) =>
    points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 40 - ((pick(point) - min) / span) * 36;
        return `${index === 0 ? "M" : "L"}${formatDigits(x, 2)} ${formatDigits(y, 2)}`;
      })
      .join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-36 w-full" role="img">
      <path d={path((point) => point.call)} fill="none" stroke="var(--bullish)" strokeWidth="0.8" />
      <path d={path((point) => point.put)} fill="none" stroke="var(--bearish)" strokeWidth="0.8" />
      <path d={path((point) => point.net)} fill="none" stroke="var(--gold)" strokeWidth="0.8" />
    </svg>
  );
}
