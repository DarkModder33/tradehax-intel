/**
 * Precompute entrypoint. P0 writes an empty manifest. Later jobs fill datasets
 * and never throw away yesterday's file when a source fails.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.env.DATA_DIR ?? "data");

export const DATASETS = [
  "insiders",
  "congress",
  "institutions",
  "oi-change",
  "iv",
  "maxpain",
  "shorts",
  "ftd",
  "ats",
  "calendar",
  "etf-flows",
  "screener",
  "seasonality",
];

export function emptyManifest(now = new Date().toISOString()) {
  const datasets = {};
  for (const name of DATASETS) {
    datasets[name] = {
      asOf: null,
      source: name,
      rows: 0,
      delay: "n/a",
      unavailable: true,
      error: "not built yet",
    };
  }
  return { generatedAt: now, datasets };
}

export async function writeManifest(dir = root, manifest = emptyManifest()) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = await writeManifest();
  console.log(`wrote ${root}/manifest.json (${Object.keys(manifest.datasets).length} datasets)`);
}
