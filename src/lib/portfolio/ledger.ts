export type BookId = "real" | "paper";
export type TxKind = "buy" | "sell" | "short" | "cover" | "dividend" | "split";

export interface Transaction {
  id: string;
  book: BookId;
  time: string;
  symbol: string;
  kind: TxKind;
  qty: number;
  price: number;
  multiplier?: number;
}

export interface Lot {
  qty: number;
  price: number;
  time: string;
}

export interface PositionView {
  symbol: string;
  qty: number;
  cost: number;
  realized: number;
  multiplier: number;
}

interface Bucket {
  lots: Lot[];
  shorts: Lot[];
  realized: number;
  multiplier: number;
}

function empty(): Bucket {
  return { lots: [], shorts: [], realized: 0, multiplier: 1 };
}

/** FIFO lots. A split scales open lots. Shorts realize when they are covered. */
export function applyLedger(transactions: Transaction[]): Map<string, PositionView> {
  const books = new Map<string, Bucket>();
  const ordered = [...transactions].sort((a, b) => a.time.localeCompare(b.time));
  for (const tx of ordered) {
    const key = `${tx.book}:${tx.symbol}`;
    const bucket = books.get(key) ?? empty();
    bucket.multiplier = tx.multiplier ?? bucket.multiplier;
    const mult = bucket.multiplier;
    if (tx.kind === "split" && tx.qty > 0) {
      for (const lot of bucket.lots) {
        lot.qty *= tx.qty;
        lot.price /= tx.qty;
      }
      for (const lot of bucket.shorts) {
        lot.qty *= tx.qty;
        lot.price /= tx.qty;
      }
    } else if (tx.kind === "buy") {
      bucket.lots.push({ qty: tx.qty, price: tx.price, time: tx.time });
    } else if (tx.kind === "sell") {
      let left = tx.qty;
      while (left > 0 && bucket.lots.length) {
        const lot = bucket.lots[0];
        const used = Math.min(lot.qty, left);
        bucket.realized += (tx.price - lot.price) * used * mult;
        lot.qty -= used;
        left -= used;
        if (lot.qty <= 1e-9) bucket.lots.shift();
      }
    } else if (tx.kind === "short") {
      bucket.shorts.push({ qty: tx.qty, price: tx.price, time: tx.time });
    } else if (tx.kind === "cover") {
      let left = tx.qty;
      while (left > 0 && bucket.shorts.length) {
        const lot = bucket.shorts[0];
        const used = Math.min(lot.qty, left);
        bucket.realized += (lot.price - tx.price) * used * mult;
        lot.qty -= used;
        left -= used;
        if (lot.qty <= 1e-9) bucket.shorts.shift();
      }
    }
    books.set(key, bucket);
  }
  const views = new Map<string, PositionView>();
  for (const [key, bucket] of books) {
    const longQty = bucket.lots.reduce((sum, lot) => sum + lot.qty, 0);
    const shortQty = bucket.shorts.reduce((sum, lot) => sum + lot.qty, 0);
    const longCost = bucket.lots.reduce((sum, lot) => sum + lot.qty * lot.price, 0);
    const shortCost = bucket.shorts.reduce((sum, lot) => sum + lot.qty * lot.price, 0);
    const qty = longQty - shortQty;
    views.set(key, {
      symbol: key.split(":").slice(1).join(":"),
      qty,
      cost: qty >= 0 ? longCost : -shortCost,
      realized: bucket.realized,
      multiplier: bucket.multiplier,
    });
  }
  return views;
}
