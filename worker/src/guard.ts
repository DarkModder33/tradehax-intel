export function cacheControl(pathname: string): string {
  if (pathname.includes("/stream")) return "no-cache";
  return "public, max-age=15";
}

export function rateLimit(hits: number[], now: number, limit = 60, windowMs = 60_000): { allowed: boolean; next: number[] } {
  const fresh = hits.filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) return { allowed: false, next: fresh };
  return { allowed: true, next: [...fresh, now] };
}

const HEAVY = ["/v1/bars", "/v1/chain-summary"];

export function isHeavy(pathname: string): boolean {
  return HEAVY.some((prefix) => pathname.startsWith(prefix));
}

export function printsFromHistory(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { rows?: unknown; prints?: unknown };
  if (Array.isArray(body.prints)) return body.prints;
  if (Array.isArray(body.rows)) return body.rows;
  return [];
}
