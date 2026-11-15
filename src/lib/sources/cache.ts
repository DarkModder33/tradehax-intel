export interface CacheEntry {
  value: string;
  expires: number;
}

export interface KvCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

export function memoryCache(now: () => number = Date.now): KvCache {
  const store = new Map<string, CacheEntry>();
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expires <= now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlMs) {
      store.set(key, { value, expires: now() + ttlMs });
    },
  };
}
