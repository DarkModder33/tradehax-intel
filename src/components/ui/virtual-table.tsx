"use client";

import { useState, type ReactNode } from "react";

const ROW = 40;

export function VirtualTable<T>({
  rows,
  height = 560,
  rowKey,
  render,
}: {
  rows: T[];
  height?: number;
  rowKey: (row: T, index: number) => string;
  render: (row: T) => ReactNode;
}) {
  const [top, setTop] = useState(0);
  const visible = Math.ceil(height / ROW) + 6;
  const start = Math.max(0, Math.floor(top / ROW) - 2);
  const slice = rows.slice(start, start + visible);
  return (
    <div className="overflow-auto rounded-xl border border-border" style={{ height }} onScroll={(event) => setTop(event.currentTarget.scrollTop)}>
      <div style={{ height: Math.max(rows.length, 1) * ROW, position: "relative" }}>
        {slice.map((row, index) => (
          <div key={rowKey(row, start + index)} className="absolute right-0 left-0 border-b border-border/50" style={{ top: (start + index) * ROW, height: ROW }}>
            {render(row)}
          </div>
        ))}
      </div>
    </div>
  );
}
