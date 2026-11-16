import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export function precacheList(outDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.includes(`${path.sep}_next${path.sep}static${path.sep}`)) {
        files.push(`/${path.relative(outDir, full).split(path.sep).join("/")}`);
      }
    }
  };
  walk(outDir);
  return ["/", "/offline/", "/manifest.webmanifest", ...files].sort();
}

if (process.argv[1] && process.argv[1].endsWith("sw-manifest.mjs")) {
  const outDir = process.argv[2] ?? "out";
  const swPath = path.join(outDir, "sw.js");
  const source = readFileSync(swPath, "utf8");
  const list = precacheList(outDir);
  const next = source.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(list)};`);
  writeFileSync(swPath, next);
  console.log(`precache ${list.length} files`);
}
