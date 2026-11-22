import type { Bar } from "@/lib/indicators/types";

export interface BarRecord {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function barsToRecords(bars: Bar[]): BarRecord[] {
  return bars.map((bar) => ({
    time: new Date(bar.time).toISOString(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
}

export interface Notebook {
  id: string;
  title: string;
  cells: string[];
}

export function notebookRoundTrip(notebook: Notebook): Notebook {
  return JSON.parse(JSON.stringify(notebook)) as Notebook;
}

export const STARTERS: Notebook[] = [
  { id: "iv-hv", title: "IV vs HV", cells: ["df = th.dataset('iv-history')\ndf"] },
  { id: "sma", title: "SMA cross", cells: ["bars = th.bars('SPY', '1Day', 200)\nbars"] },
  { id: "corr", title: "Correlation", cells: ["print('correlation starter')"] },
  { id: "earn", title: "Earnings moves", cells: ["print(th.dataset('earnings-moves'))"] },
];
