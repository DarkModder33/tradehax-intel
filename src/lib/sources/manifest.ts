import { SITE_BASE, withBase } from "@/lib/site";

export { SITE_BASE };

export interface DatasetMeta {
  asOf: string | null;
  source: string;
  rows: number;
  delay: string;
  stale?: boolean;
  unavailable?: boolean;
  error?: string;
  coverage?: number;
}

export interface DataManifest {
  generatedAt: string | null;
  datasets: Record<string, DatasetMeta>;
}

export function datasetUrl(name: string, base = SITE_BASE): string {
  return withBase(`/data/${name.replace(/^\/+/, "")}`, base);
}

export function manifestUrl(base = SITE_BASE): string {
  return datasetUrl("manifest.json", base);
}

export function emptyDataset(source: string, error: string): DatasetMeta {
  return { asOf: null, source, rows: 0, delay: "n/a", unavailable: true, error };
}
