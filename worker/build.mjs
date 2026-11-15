// Bundles src/server.ts and the shared ../src/lib modules into dist/server.mjs so worker/ can be deployed alone.
// Run from the repo root with esbuild available: npx esbuild is enough (node worker/build.mjs).
import { build } from "esbuild";
await build({
  entryPoints: [new URL("./src/server.ts", import.meta.url).pathname],
  outfile: new URL("./dist/server.mjs", import.meta.url).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: new URL("../tsconfig.json", import.meta.url).pathname,
  logLevel: "info",
});
