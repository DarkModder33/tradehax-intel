/** Public worker origin. Set NEXT_PUBLIC_WORKER_URL=off to hide the live feed. */
export const DEFAULT_WORKER_URL = "https://tradehax-intel-worker-bf2f623ce81a.herokuapp.com";

export function workerUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WORKER_URL ?? DEFAULT_WORKER_URL;
  return raw.replace(/\/+$/, "");
}

export function workerConnected(): boolean {
  const url = workerUrl();
  return url.length > 0 && url !== "off";
}

export function healthBody(now = new Date().toISOString()) {
  return { ok: true, lastPoll: null as string | null, delaySec: null as number | null, universeSize: 0, asOf: now };
}
