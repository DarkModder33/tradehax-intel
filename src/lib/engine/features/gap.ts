import type { Bar } from "@/lib/indicators/types";

export interface GapSplit {
  overnight: number;
  intraday: number;
  overnight20: number | null;
  intraday20: number | null;
}

export function gapSplit(bars: Bar[]): GapSplit | null {
  if (bars.length < 2) return null;
  const last = bars.length - 1;
  const previousClose = bars[last - 1].close;
  if (previousClose === 0 || bars[last].open === 0) return null;
  const overnight = bars[last].open / previousClose - 1;
  const intraday = bars[last].close / bars[last].open - 1;
  const overnightLegs: number[] = [];
  const intradayLegs: number[] = [];
  for (let index = Math.max(1, bars.length - 20); index < bars.length; index += 1) {
    if (bars[index - 1].close === 0 || bars[index].open === 0) continue;
    overnightLegs.push(bars[index].open / bars[index - 1].close - 1);
    intradayLegs.push(bars[index].close / bars[index].open - 1);
  }
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return {
    overnight,
    intraday,
    overnight20: overnightLegs.length >= 5 ? sum(overnightLegs) : null,
    intraday20: intradayLegs.length >= 5 ? sum(intradayLegs) : null,
  };
}
