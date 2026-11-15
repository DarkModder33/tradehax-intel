/** Public worker origin. Empty means the static site has no live feed connected. */
export function workerUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WORKER_URL ?? "";
  return raw.replace(/\/+$/, "");
}

export function workerConnected(): boolean {
  return workerUrl().length > 0;
}

export function healthBody(now = new Date().toISOString()) {
  return { ok: true, lastPoll: null as string | null, delaySec: null as number | null, universeSize: 0, asOf: now };
}
