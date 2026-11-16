const MEMORY = new Map<string, string>();

function memoryStore() {
  return {
    async get(key: string) {
      return MEMORY.get(key) ?? null;
    },
    async set(key: string, value: string) {
      MEMORY.set(key, value);
    },
  };
}

export async function localGet(key: string): Promise<string | null> {
  if (typeof indexedDB === "undefined") {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return memoryStore().get(key);
  }
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("kv", "readonly").objectStore("kv").get(key);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

export async function localSet(key: string, value: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }
    await memoryStore().set(key, value);
    return;
  }
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("kv", "readwrite").objectStore("kv").put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tradehax", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
