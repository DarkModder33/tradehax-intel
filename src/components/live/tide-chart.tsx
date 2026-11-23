"use client";

import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/format";

export interface TidePointIn {
  time: string;
  call: number;
  put: number;
  net: number;
}

const W = 960;
const H = 280;
const PAD = { left: 64, right: 16, top: 16, bottom: 28 };

const r1 = (value: number) => Math.round(value * 10) / 10;

const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const unit = [1, 2, 5, 10].map((mult) => mult * step).find((value) => span / value <= count) ?? step * 10;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / unit) * unit; value <= max; value += unit) ticks.push(value);
  return ticks;
}

/** Intraday cumulative call premium, put premium, and call minus put, in ET. */
export function TideChart({ points, label }: { points: TidePointIn[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shape = useMemo(() => {
    if (points.length < 2) return null;
    const times = points.map((point) => Date.parse(point.time));
    const values = points.flatMap((point) => [point.call, point.put, point.net, 0]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const t0 = times[0];
    const t1 = times[times.length - 1] === t0 ? t0 + 60_000 : times[times.length - 1];
    const x = (time: number) => PAD.left + ((time - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (value: number) => PAD.top + (1 - (value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const line = (key: "call" | "put" | "net") => points.map((point, index) => `${index ? "L" : "M"}${r1(x(times[index]))},${r1(y(point[key]))}`).join(" ");
    const netArea = `${line("net")} L${r1(x(times[times.length - 1]))},${r1(y(0))} L${r1(x(times[0]))},${r1(y(0))} Z`;
    const hourTicks: number[] = [];
    const firstHour = Math.ceil(t0 / 1_800_000) * 1_800_000;
    for (let time = firstHour; time <= t1; time += 1_800_000) hourTicks.push(time);
    const stride = Math.max(1, Math.ceil(hourTicks.length / 7));
    return { times, x, y, line, netArea, yTicks: niceTicks(lo, hi), xTicks: hourTicks.filter((_, index) => index % stride === 0) };
  }, [points]);

  if (!shape) return <div className="surface px-4 py-10 text-center text-sm text-muted-foreground">Not enough prints in this session for a tide line yet.</div>;
  const last = points[points.length - 1];
  const active = hover != null ? points[hover] : last;

  return (
    <figure className="surface p-3">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{clock.format(new Date(active.time))} ET</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#61da92]" /> Net call <b className="font-mono font-medium">{formatCompact(active.call)}</b></span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#f97676]" /> Net put <b className="font-mono font-medium">{formatCompact(active.put)}</b></span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#f3d27a]" /> Call − put <b className="font-mono font-medium">{formatCompact(active.net)}</b></span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${label}: net call ${formatCompact(last.call)}, net put ${formatCompact(last.put)}, call minus put ${formatCompact(last.net)}`}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * W;
          let best = 0;
          for (let index = 1; index < shape.times.length; index += 1) {
            if (Math.abs(shape.x(shape.times[index]) - px) < Math.abs(shape.x(shape.times[best]) - px)) best = index;
          }
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="tide-net" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3d27a" stopOpacity="0.28" />
            <stop offset="1" stopColor="#f3d27a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {shape.yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={shape.y(tick)} y2={shape.y(tick)} stroke={tick === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.06)"} strokeDasharray={tick === 0 ? "4 4" : undefined} />
            <text x={PAD.left - 8} y={shape.y(tick) + 4} textAnchor="end" fontSize="11" fill="rgba(200,206,220,0.7)" fontFamily="ui-monospace, monospace">{formatCompact(tick)}</text>
          </g>
        ))}
        {shape.xTicks.map((tick) => (
          <text key={tick} x={shape.x(tick)} y={H - 8} textAnchor="middle" fontSize="11" fill="rgba(200,206,220,0.7)">{clock.format(new Date(tick))}</text>
        ))}
        <path d={shape.netArea} fill="url(#tide-net)" />
        <path d={shape.line("call")} fill="none" stroke="#61da92" strokeWidth="2" strokeLinejoin="round" />
        <path d={shape.line("put")} fill="none" stroke="#f97676" strokeWidth="2" strokeLinejoin="round" />
        <path d={shape.line("net")} fill="none" stroke="#f3d27a" strokeWidth="2.25" strokeLinejoin="round" />
        {hover != null ? (
          <g>
            <line x1={shape.x(shape.times[hover])} x2={shape.x(shape.times[hover])} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.3)" />
            {(["call", "put", "net"] as const).map((key) => (
              <circle key={key} cx={shape.x(shape.times[hover])} cy={shape.y(points[hover][key])} r="3.5" fill={key === "call" ? "#61da92" : key === "put" ? "#f97676" : "#f3d27a"} />
            ))}
          </g>
        ) : null}
      </svg>
    </figure>
  );
}
