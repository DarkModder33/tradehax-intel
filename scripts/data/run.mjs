import { mkdir, readFile, writeFile } from "node:fs/promises";
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
    // A failed source keeps the last good file instead of blanking the page. The manifest
    // still records the failure so /status shows it.
    if (datasets[name]?.unavailable) {
      const prior = await readFile(file, "utf8").then(JSON.parse).catch(() => null);
      const priorRows = prior?.rows;
      const hasRows = Array.isArray(priorRows) ? priorRows.length > 0 : priorRows && typeof priorRows === "object" ? Object.keys(priorRows).length > 0 : false;
      if (hasRows && !prior?.meta?.unavailable) {
        datasets[name] = { ...prior.meta, stale: true, error: datasets[name].error ?? "source failed; kept the last good file" };
        console.log(`${name}: unavailable, kept last good file from ${prior.meta?.asOf ?? "unknown"}`);
        continue;
      }
    }
    await writeFile(file, JSON.stringify(payload, null, 2));
    if (payload.history) await writeFile(path.join(dir, "iv-history.json"), JSON.stringify(payload.history, null, 2));
    if (payload.snapshot) await writeFile(path.join(dir, "oi-snapshot.json"), JSON.stringify({ snapshot: payload.snapshot }));
    for (const [extra, body] of Object.entries(payload.files ?? {})) await writeFile(path.join(dir, extra), JSON.stringify(body));
    console.log(`${name}: ${datasets[name].unavailable ? "unavailable" : datasets[name].rows + " rows"}`);
  }
  const manifest = { generatedAt: new Date().toISOString(), datasets };
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("run.mjs")) {
  await buildDatasets();
}
