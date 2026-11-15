import { TIMEFRAMES, type Timeframe } from "@/lib/indicators/types";
import { sanitizeSymbols } from "@/lib/market/symbols";

export const POPOUT_STORAGE_KEY = "tradehax.popout";
export const SITE_BASE = "/tradehax-intel";

export interface PopoutPrefs {
  symbols: string[];
  timeframe: Timeframe;
  sound: boolean;
}

export const DEFAULT_POPOUT: PopoutPrefs = {
  symbols: ["SPY", "NVDA"],
  timeframe: "5m",
  sound: false,
};

export function isTimeframe(value: string | null | undefined): value is Timeframe {
  return Boolean(value && (TIMEFRAMES as readonly string[]).includes(value.toLowerCase()));
}

export function normalizePopoutPrefs(input: Partial<PopoutPrefs> | null | undefined): PopoutPrefs {
  const listed = Array.isArray(input?.symbols);
  const symbols = sanitizeSymbols(input?.symbols ?? []);
  const rawTimeframe = typeof input?.timeframe === "string" ? input.timeframe.toLowerCase() : "";
  return {
    symbols: symbols.length > 0 ? symbols : listed ? [] : [...DEFAULT_POPOUT.symbols],
    timeframe: isTimeframe(rawTimeframe) ? rawTimeframe : DEFAULT_POPOUT.timeframe,
    sound: input?.sound === true,
  };
}

/** Query values override symbols and timeframe. Sound stays a local choice. */
export function parsePopoutSearch(search: string): Partial<PopoutPrefs> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const next: Partial<PopoutPrefs> = {};
  if (params.has("symbols")) {
    const symbols = sanitizeSymbols((params.get("symbols") ?? "").split(","));
    if (symbols.length > 0) next.symbols = symbols;
  }
  const timeframe = params.get("tf")?.toLowerCase();
  if (isTimeframe(timeframe)) next.timeframe = timeframe;
  return next;
}

export function mergePopoutPrefs(stored: PopoutPrefs, search: string): PopoutPrefs {
  const query = parsePopoutSearch(search);
  return normalizePopoutPrefs({
    symbols: query.symbols ?? stored.symbols,
    timeframe: query.timeframe ?? stored.timeframe,
    sound: stored.sound,
  });
}

export interface PopoutRecord {
  prefs: PopoutPrefs;
  /** The query last accepted from a link, including the leading "?". */
  appliedSearch: string;
}

export function readPopoutRecord(raw: string | null): PopoutRecord {
  const empty: PopoutRecord = {
    prefs: { ...DEFAULT_POPOUT, symbols: [...DEFAULT_POPOUT.symbols] },
    appliedSearch: "",
  };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<PopoutPrefs> & { appliedSearch?: unknown };
    return {
      prefs: normalizePopoutPrefs(parsed),
      appliedSearch: typeof parsed.appliedSearch === "string" ? parsed.appliedSearch : "",
    };
  } catch {
    return empty;
  }
}

export function serializePopoutRecord(record: PopoutRecord): string {
  const prefs = normalizePopoutPrefs(record.prefs);
  return JSON.stringify({
    symbols: prefs.symbols,
    timeframe: prefs.timeframe,
    sound: prefs.sound,
    appliedSearch: record.appliedSearch,
  });
}

/** A new query is a new link. The same query keeps whatever the user saved after opening it. */
export function resolveVisit(record: PopoutRecord, search: string): PopoutRecord {
  if (search && search !== record.appliedSearch) {
    return { prefs: mergePopoutPrefs(record.prefs, search), appliedSearch: search };
  }
  return record;
}

export function popoutPath(prefs: Pick<PopoutPrefs, "symbols" | "timeframe">): string {
  const symbols = prefs.symbols.map((symbol) => encodeURIComponent(symbol)).join(",");
  return `${SITE_BASE}/popout/?symbols=${symbols}&tf=${encodeURIComponent(prefs.timeframe)}`;
}

export function readPopoutPrefs(storage: Pick<Storage, "getItem"> | null): PopoutPrefs {
  if (!storage) return { ...DEFAULT_POPOUT, symbols: [...DEFAULT_POPOUT.symbols] };
  try {
    const raw = storage.getItem(POPOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POPOUT, symbols: [...DEFAULT_POPOUT.symbols] };
    return normalizePopoutPrefs(JSON.parse(raw) as Partial<PopoutPrefs>);
  } catch {
    return { ...DEFAULT_POPOUT, symbols: [...DEFAULT_POPOUT.symbols] };
  }
}

export function writePopoutPrefs(storage: Pick<Storage, "setItem"> | null, prefs: PopoutPrefs): void {
  storage?.setItem(POPOUT_STORAGE_KEY, JSON.stringify(normalizePopoutPrefs(prefs)));
}
