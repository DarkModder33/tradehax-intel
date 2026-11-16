import { memoryCache, type KvCache } from "./cache";

interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

interface Stored {
  value: string;
  expires: number;
}

function openTradehax(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tradehax", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB did not open"));
  });
}

function idbStore(db: IDBDatabase): Store {
  return {
    get(key) {
      return new Promise((resolve, reject) => {
        const request = db.transaction("kv", "readonly").objectStore("kv").get(key);
        request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
        request.onerror = () => reject(request.error);
      });
    },
    set(key, value) {
      return new Promise((resolve, reject) => {
        const request = db.transaction("kv", "readwrite").objectStore("kv").put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
  };
}

/** TTL lives in the record so every tab sees the same expiry. */
export function cacheFromStore(store: Store, now: () => number = Date.now): KvCache {
  return {
    async get(key) {
      const raw = await store.get(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Stored;
        if (!parsed || typeof parsed.value !== "string" || parsed.expires <= now()) return null;
        return parsed.value;
      } catch {
        return null;
      }
    },
    async set(key, value, ttlMs) {
      const record: Stored = { value, expires: now() + ttlMs };
      await store.set(key, JSON.stringify(record));
    },
  };
}

export function idbCache(open: () => Promise<IDBDatabase> = openTradehax, now: () => number = Date.now): KvCache {
  let pending: Promise<Store> | null = null;
  const store = () => {
    pending ??= open().then(idbStore);
    return pending;
  };
  return cacheFromStore(
    {
      get: async (key) => (await store()).get(key),
      set: async (key, value) => (await store()).set(key, value),
    },
    now,
  );
}

/** IndexedDB when the browser has it, otherwise a process-local map. */
export function sharedCache(now: () => number = Date.now): KvCache {
  if (typeof indexedDB === "undefined") return memoryCache(now);
  return idbCache(openTradehax, now);
}
