/**
 * Public site prefix. Unset keeps the GitHub project path. An empty string is the domain root.
 */
export function normalizeBasePath(raw: string | undefined | null): string {
  if (raw == null) return "/tradehax-intel";
  if (raw === "" || raw === "/") return "";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const SITE_BASE = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export function withBase(path: string, base = SITE_BASE): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${suffix}` : suffix;
}
