import { postPopout } from "./channel";
import {
  POPOUT_STORAGE_KEY,
  normalizePopoutPrefs,
  readPopoutRecord,
  resolveVisit,
  serializePopoutRecord,
  type PopoutPrefs,
} from "./prefs";

const SERVER_PREFS: PopoutPrefs = {
  symbols: ["SPY", "NVDA"],
  timeframe: "5m",
  sound: false,
};

let cache: PopoutPrefs = SERVER_PREFS;
let cacheKey = "";
let lastJson = "";
const listeners = new Set<() => void>();

function snapshotKey(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(POPOUT_STORAGE_KEY) ?? "";
  const search = window.location.pathname.includes("/popout") ? window.location.search : "";
  return `${raw}@@${search}`;
}

function remember(prefs: PopoutPrefs): PopoutPrefs {
  cache = prefs;
  cacheKey = snapshotKey();
  lastJson = JSON.stringify(prefs);
  return prefs;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribePopout(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function currentRecord(): ReturnType<typeof readPopoutRecord> {
  if (typeof window === "undefined") return { prefs: SERVER_PREFS, appliedSearch: "" };
  return readPopoutRecord(window.localStorage.getItem(POPOUT_STORAGE_KEY));
}

function storeRecord(record: ReturnType<typeof readPopoutRecord>): void {
  const raw = window.localStorage.getItem(POPOUT_STORAGE_KEY) ?? "";
  const next = serializePopoutRecord(record);
  if (next !== raw) window.localStorage.setItem(POPOUT_STORAGE_KEY, next);
}

export function getPopoutSnapshot(): PopoutPrefs {
  if (typeof window === "undefined") return SERVER_PREFS;
  const key = snapshotKey();
  if (key === cacheKey) return cache;
  const onPopout = window.location.pathname.includes("/popout");
  const record = onPopout ? resolveVisit(currentRecord(), window.location.search) : currentRecord();
  storeRecord(record);
  return remember(record.prefs);
}

export function getServerPopoutSnapshot(): PopoutPrefs {
  return SERVER_PREFS;
}

export function publishPopoutPrefs(next: PopoutPrefs): PopoutPrefs {
  const prefs = normalizePopoutPrefs(next);
  if (typeof window !== "undefined") {
    storeRecord({ prefs, appliedSearch: currentRecord().appliedSearch });
  }
  remember(prefs);
  postPopout({ type: "prefs", prefs });
  emit();
  return prefs;
}

/** Apply a prefs update that another window already announced. */
export function adoptPopoutPrefs(next: PopoutPrefs): void {
  const prefs = normalizePopoutPrefs(next);
  if (JSON.stringify(prefs) === lastJson) return;
  if (typeof window !== "undefined") {
    storeRecord({ prefs, appliedSearch: currentRecord().appliedSearch });
  }
  remember(prefs);
  emit();
}
