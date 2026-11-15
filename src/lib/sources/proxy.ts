/** Keyless GET proxy. The upstream URL is appended, the same way the Yahoo chart calls are built. */
export const CORS_PROXY = "https://proxy.cors.dev/";

export function proxiedUrl(upstream: string): string {
  return `${CORS_PROXY}${upstream}`;
}
