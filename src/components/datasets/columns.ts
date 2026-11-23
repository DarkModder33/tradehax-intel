import { formatCompact, formatPrice, formatSignedPercent } from "@/lib/format";

type Row = Record<string, unknown>;

export interface Column {
  label: string;
  value: (row: Row) => string;
  href?: (row: Row) => string | null;
  numeric?: boolean;
}

export interface DatasetLayout {
  columns: Column[];
  /** Larger first. Return a sortable string or number. */
  sortKey?: (row: Row) => string | number;
  ascending?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FORM4_CODES: Record<string, string> = {
  P: "Open-market buy",
  S: "Open-market sale",
  A: "Grant or award",
  M: "Option exercise",
  F: "Tax withholding",
  G: "Gift",
  C: "Conversion",
  D: "Disposition to issuer",
  X: "Option exercise",
};

function num(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function int(value: unknown): string {
  const parsed = num(value);
  return parsed == null ? "—" : Math.round(parsed).toLocaleString("en-US");
}

function pct(value: unknown, digits = 1): string {
  const parsed = num(value);
  return parsed == null ? "—" : formatSignedPercent(parsed, digits);
}

function plainPct(value: unknown): string {
  const parsed = num(value);
  return parsed == null ? "—" : `${Math.round(parsed * 100)}%`;
}

/** "Woods Todd Charles  (CIK 0002149159)" becomes "Woods Todd Charles". */
function stripCik(value: unknown): string {
  return String(value ?? "").replace(/\s*\(CIK \d+\)\s*/g, "").trim();
}

/** M/D/YYYY or YYYY-MM-DD as a sortable YYYY-MM-DD. */
export function isoDay(value: unknown): string {
  const raw = String(value ?? "");
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return raw.slice(0, 10);
}

function trade(row: Row): Row {
  return (row.trade && typeof row.trade === "object" ? row.trade : {}) as Row;
}

function edgarHref(row: Row): string | null {
  const id = String(row.id ?? "").split(":")[0];
  const match = id.match(/^(\d{10})-(\d{2})-(\d{6})$/);
  if (!match) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(match[1])}/${id.replace(/-/g, "")}/${id}-index.htm`;
}

export const LAYOUTS: Record<string, DatasetLayout> = {
  seasonality: {
    columns: [
      { label: "Symbol", value: (row) => text(row.symbol) },
      { label: "Month", value: (row) => MONTHS[(num(row.month) ?? 0) - 1] ?? text(row.month) },
      { label: "Average", value: (row) => pct(row.average), numeric: true },
      { label: "Median", value: (row) => pct(row.median), numeric: true },
      { label: "Worst", value: (row) => pct(row.min), numeric: true },
      { label: "Best", value: (row) => pct(row.max), numeric: true },
      { label: "Up years", value: (row) => plainPct(row.positive), numeric: true },
      { label: "Years", value: (row) => int(row.samples), numeric: true },
    ],
  },
  congress: {
    columns: [
      { label: "Filed", value: (row) => isoDay(row.filed) },
      { label: "Member", value: (row) => text(row.name).replace(/^Hon\.\s*/, "") },
      { label: "District", value: (row) => text(row.state) },
      { label: "Report", value: (row) => (row.filingType === "P" ? "Periodic transaction report" : text(row.filingType)) },
      {
        label: "Filing",
        value: (row) => (row.docId ? "PDF" : "—"),
        href: (row) => (row.docId ? `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${isoDay(row.filed).slice(0, 4)}/${row.docId}.pdf` : null),
      },
    ],
    sortKey: (row) => isoDay(row.filed),
  },
  institutions: {
    columns: [
      { label: "Filed", value: (row) => isoDay(row.filed) },
      { label: "Manager", value: (row) => (Array.isArray(row.names) ? row.names.map(stripCik).join(", ") : "—") },
      { label: "Filing", value: () => "EDGAR", href: edgarHref },
    ],
    sortKey: (row) => isoDay(row.filed),
  },
  insiders: {
    columns: [
      { label: "Filed", value: (row) => isoDay(row.filed) },
      { label: "Ticker", value: (row) => text(trade(row).ticker) },
      { label: "Insider", value: (row) => text(trade(row).owner ?? (Array.isArray(row.names) ? stripCik(row.names[0]) : null)) },
      { label: "Transaction", value: (row) => FORM4_CODES[String(trade(row).code ?? "")] ?? text(trade(row).code) },
      { label: "Shares", value: (row) => int(trade(row).shares), numeric: true },
      { label: "Price", value: (row) => (num(trade(row).price) == null ? "—" : formatPrice(num(trade(row).price) as number)), numeric: true },
      {
        label: "Value",
        value: (row) => {
          const shares = num(trade(row).shares);
          const price = num(trade(row).price);
          return shares != null && price != null ? formatCompact(shares * price) : "—";
        },
        numeric: true,
      },
      { label: "Filing", value: () => "EDGAR", href: edgarHref },
    ],
    sortKey: (row) => isoDay(row.filed),
  },
  "etf-flows": {
    columns: [
      { label: "Date", value: (row) => isoDay(row.date) },
      { label: "ETF", value: (row) => text(row.symbol) },
      { label: "NAV", value: (row) => (num(row.nav) == null ? "—" : formatPrice(num(row.nav) as number)), numeric: true },
      { label: "Shares out", value: (row) => int(row.shares), numeric: true },
      { label: "Net flow", value: (row) => (num(row.flow) == null ? "—" : formatCompact(num(row.flow))), numeric: true },
    ],
    sortKey: (row) => isoDay(row.date),
  },
  calendar: {
    columns: [
      { label: "Date", value: (row) => isoDay(row.date) },
      { label: "Event", value: (row) => (row.kind === "earnings" ? "Earnings" : text(row.kind)) },
      { label: "Symbol", value: (row) => text(row.symbol ?? row.event) },
      { label: "Name", value: (row) => text(row.name) },
      { label: "Time", value: (row) => text(row.time).replace(/^time-/, "").replace(/-/g, " ").replace("not supplied", "n/a") },
      { label: "EPS est.", value: (row) => text(row.epsForecast), numeric: true },
      { label: "EPS last year", value: (row) => text(row.lastYearEPS), numeric: true },
    ],
    sortKey: (row) => isoDay(row.date),
    ascending: true,
  },
};

/** Generic fallback: humanized headers and readable cells for files without a layout. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function formatCell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => (typeof item === "object" ? formatCell(item) : stripCik(item))).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Row)
      .filter(([, item]) => item != null && typeof item !== "object")
      .slice(0, 4)
      .map(([key, item]) => `${humanizeKey(key)}: ${formatCell(item)}`)
      .join(" · ");
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString("en-US");
    return value.toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 4 });
  }
  return String(value);
}

export function genericLayout(rows: Row[]): DatasetLayout {
  const keys = Object.keys(rows[0] ?? {}).slice(0, 7);
  return { columns: keys.map((key) => ({ label: humanizeKey(key), value: (row: Row) => formatCell(row[key]) })) };
}
