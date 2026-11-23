import { readFileSync } from "node:fs";
import path from "node:path";

export interface AffiliateLink {
  href: string;
  label: string;
}

type Env = Record<string, string | undefined>;

export function adsenseConfig(env: Env = process.env): { client: string; slot: string } | null {
  const client = env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "";
  const slot = env.NEXT_PUBLIC_ADSENSE_SLOT?.trim() ?? "";
  if (!client || !slot) return null;
  return { client, slot };
}

export function adsTxtLine(client: string | undefined): string | null {
  const id = (client ?? "").trim().replace(/^ca-/, "");
  if (!/^pub-[0-9]+$/.test(id)) return null;
  return `google.com, ${id}, DIRECT, f08c47fec0942fa0\n`;
}

export function newsletterUrl(env: Env = process.env): string | null {
  const url = env.NEXT_PUBLIC_NEWSLETTER_URL?.trim() ?? "";
  return url || null;
}

export function gscToken(env: Env = process.env): string | null {
  const token = env.NEXT_PUBLIC_GSC_VERIFICATION?.trim() ?? "";
  return token || null;
}

export function affiliateLinks(rows: unknown): AffiliateLink[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is AffiliateLink => {
    if (!row || typeof row !== "object") return false;
    const candidate = row as AffiliateLink;
    return typeof candidate.href === "string" && candidate.href.startsWith("https://") && typeof candidate.label === "string" && candidate.label.trim().length > 0;
  });
}

export function loadAffiliates(): AffiliateLink[] {
  try {
    return affiliateLinks(JSON.parse(readFileSync(path.join(process.cwd(), "content", "affiliates.json"), "utf8")));
  } catch {
    return [];
  }
}
