import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { JOBS } from "./jobs.mjs";

const root = path.resolve(process.env.DATA_DIR ?? "data");

function metaOf(payload) {
  if (payload?.earnings) {
    return {
      asOf: payload.earnings.meta?.asOf ?? null,
      source: "Nasdaq calendars",
      rows: (payload.earnings.meta?.rows ?? 0) + (payload.economic.meta?.rows ?? 0),
      delay: "daily",
      unavailable: Boolean(payload.earnings.meta?.unavailable && payload.economic.meta?.unavailable),
      error: payload.earnings.meta?.error,
    };
  }
  return payload.meta;
}

export async function buildDatasets(dir = root) {
  await mkdir(dir, { recursive: true });
  const datasets = {};
  for (const [name, job] of Object.entries(JOBS)) {
    const payload = await job();
    datasets[name] = metaOf(payload);
    const file = path.join(dir, `${name}.json`);
    await writeFile(file, JSON.stringify(payload, null, 2));
    console.log(`${name}: ${datasets[name].unavailable ? "unavailable" : datasets[name].rows + " rows"}`);
  }
  const manifest = { generatedAt: new Date().toISOString(), datasets };
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("run.mjs")) {
  await buildDatasets();
}
