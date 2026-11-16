import type { Bar } from "@/lib/indicators/types";
import { ruleTrue, type StrategySpec } from "./rules";

export interface Trade {
  side: 1 | -1;
  entryIndex: number;
  exitIndex: number;
  entry: number;
  exit: number;
  pnl: number;
  reason: "signal" | "stop" | "target" | "time" | "end";
}

export interface Simulation {
  trades: Trade[];
  equity: number[];
  /** True when a stop and a target both printed. The stop is taken. */
  stopFirst: boolean;
}

function slip(price: number, side: 1 | -1, bps: number, entering: boolean): number {
  const sign = entering ? side : -side;
  return price * (1 + (sign * bps) / 10_000);
}

export function simulate(bars: Bar[], spec: StrategySpec, options?: { costBps?: number; startingEquity?: number }): Simulation {
  const costBps = options?.costBps ?? 0;
  const equity = new Array<number>(bars.length).fill(options?.startingEquity ?? 10_000);
  const trades: Trade[] = [];
  const cache = new Map<string, Array<number | null>>();
  let position: { side: 1 | -1; entry: number; entryIndex: number; qty: number } | null = null;
  let stopFirst = false;
  let cash = equity[0];

  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index];
    if (position) {
      const held = index - position.entryIndex;
      const stop = spec.stopPct != null ? position.entry * (1 - position.side * spec.stopPct) : null;
      const target = spec.targetPct != null ? position.entry * (1 + position.side * spec.targetPct) : null;
      const stopHit = stop != null && (position.side === 1 ? bar.low <= stop : bar.high >= stop);
      const targetHit = target != null && (position.side === 1 ? bar.high >= target : bar.low <= target);
      let exitPrice: number | null = null;
      let reason: Trade["reason"] | null = null;
      if (stopHit) {
        exitPrice = stop!;
        reason = "stop";
        if (targetHit) stopFirst = true;
      } else if (targetHit) {
        exitPrice = target!;
        reason = "target";
      } else if (spec.timeStop != null && held >= spec.timeStop) {
        exitPrice = bar.open;
        reason = "time";
      } else if (ruleTrue(bars, index - 1, spec.exit, cache)) {
        exitPrice = bar.open;
        reason = "signal";
      }
      if (exitPrice != null && reason) {
        const fill = slip(exitPrice, position.side, costBps, false);
        const pnl = position.side * position.qty * (fill - position.entry);
        cash += position.qty * fill * (position.side === 1 ? 1 : 0);
        if (position.side === -1) cash += position.qty * (position.entry - fill) + position.qty * position.entry;
        trades.push({ side: position.side, entryIndex: position.entryIndex, exitIndex: index, entry: position.entry, exit: fill, pnl, reason });
        position = null;
      }
    }
    if (!position && ruleTrue(bars, index - 1, spec.entry, cache)) {
      const side: 1 | -1 = spec.side === "short" ? -1 : 1;
      if (spec.side === "both") {
        // A later exit can flip. The first entry follows the rule as a long unless the exit rule is already true.
      }
      const fill = slip(bar.open, side, costBps, true);
      const qty = Math.max(0, (cash * spec.sizePct) / fill);
      if (qty > 0) {
        if (side === 1) cash -= qty * fill;
        position = { side, entry: fill, entryIndex: index, qty };
      }
    }
    const marked = position ? cash + position.qty * (position.side === 1 ? bar.close : position.entry * 2 - bar.close) : cash;
    equity[index] = marked;
  }
  if (position) {
    const last = bars[bars.length - 1];
    const fill = slip(last.close, position.side, costBps, false);
    const pnl = position.side * position.qty * (fill - position.entry);
    trades.push({ side: position.side, entryIndex: position.entryIndex, exitIndex: bars.length - 1, entry: position.entry, exit: fill, pnl, reason: "end" });
  }
  return { trades, equity, stopFirst };
}
