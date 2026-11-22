import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const LIMIT = 600 * 1024;
const strict = process.env.BUDGET_STRICT === "1";

function walk(dir, out = []) {
  if (!statSafe(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (entry.endsWith(".js")) out.push({ full, size: stat.size });
  }
  return out;
}

function statSafe(dir) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

const manifestPath = path.join(".next", "build-manifest.json");
let bytes = 0;
if (statSafe(".next") && readFileSync) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const files = [...(manifest.polyfillFiles ?? []), ...(manifest.rootMainFiles ?? []), ...(manifest.pages?.["/"] ?? [])];
    for (const file of files) {
      const nextStatic = path.join(".next", file.startsWith("static/") ? file : path.join("static", file));
      try {
        bytes += statSync(nextStatic).size;
      } catch {
        try {
          bytes += statSync(path.join(".next", file)).size;
        } catch {
          // Missing chunk is reported below if nothing was measured.
        }
      }
    }
  } catch {
    bytes = 0;
  }
}

if (!bytes) {
  const chunks = walk(path.join(".next", "static", "chunks"));
  const home = chunks.filter((file) => file.full.includes(`${path.sep}app${path.sep}`) || file.full.endsWith(`${path.sep}main-app.js`) || file.full.includes("webpack"));
  bytes = home.reduce((sum, file) => sum + file.size, 0);
}

if (!bytes) {
  console.error("bundle budget: could not measure first-load JavaScript");
  process.exit(1);
}

const kb = (bytes / 1024).toFixed(1);
const limitKb = (LIMIT / 1024).toFixed(0);
if (bytes > LIMIT) {
  const message = `bundle budget: / first-load JS is ${kb} KB, above ${limitKb} KB`;
  if (strict) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message}. Warning only. Set BUDGET_STRICT=1 to fail.`);
  process.exit(0);
}
console.log(`bundle budget: / first-load JS is ${kb} KB (limit ${limitKb} KB)`);
